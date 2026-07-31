const GIWA = {
  chainId: 91342,
  chainIdHex: "0x164ce",
  rpcUrl: "https://sepolia-rpc.giwa.io",
  explorer: "https://sepolia-explorer.giwa.io",
  contracts: {
    USDC: "0x69d13eaea37866e196d1d1b9185e7e534f5fc2cc",
    KRW: "0xaefdbeae2d1b140f366da7cb8f075ad5956e3751",
    BatchTransfer: "0x9ad98ed6936a6bbc0e6364ff4da088c043d71711",
  },
};

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function mint(address,uint256)",
  "function approve(address,uint256) returns (bool)",
];
const BATCH_ABI = [
  "function batchTransfer(address,address[],uint256[])",
  "function splitTransfer(address,address[],uint256[],uint256)",
];

const state = {
  account: "",
  provider: null,
  signer: null,
  balances: { USDC: 0n, KRW: 0n },
  allowances: { USDC: 0n, KRW: 0n },
  history: JSON.parse(localStorage.getItem("divvypay-history") || "[]"),
};

const E = window.ethers || {
  parseUnits(value, decimals) {
    const raw = String(value || "0").trim();
    if (!/^\d+(\.\d*)?$/.test(raw)) throw new Error("Invalid amount");
    const [whole, fraction = ""] = raw.split(".");
    return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals));
  },
  formatUnits(value, decimals) {
    const base = 10n ** BigInt(decimals);
    const amount = BigInt(value);
    const whole = amount / base;
    const fraction = (amount % base).toString().padStart(decimals, "0").replace(/0+$/, "");
    return fraction ? `${whole}.${fraction}` : whole.toString();
  },
  isAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  },
};

const sampleCsv = `address,amount,label
0x71ce15c5a0f4b9d7217b8a7a2e6d9d3f55a9ce1,250,Payroll - Designer
0x43d3ec372cb6fc158d7bc78377042d01d3a3b790,180,Payroll - Engineer
0xa11ce00000000000000000000000000000000001,50,Contributor - Docs`;

const $ = (id) => document.querySelector(id);
const tokenLabel = (token) => (token === "KRW" ? "MockKRW" : "MockUSDC");
const tokenAddress = (token) => GIWA.contracts[token];
const shortAddress = (address) => (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected");
const normalizeAddress = (address) => String(address || "").trim().toLowerCase();
const parseAmount = (value) => E.parseUnits(String(value || "0"), 6);
const formatRaw = (value, token) => `${Number(E.formatUnits(value, 6)).toLocaleString(undefined, { maximumFractionDigits: token === "KRW" ? 0 : 2 })} ${tokenLabel(token)}`;
const explorerTx = (hash) => `${GIWA.explorer}/tx/${hash}`;

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 4200);
}

function setButton(button, disabled, label) {
  button.disabled = disabled;
  button.textContent = label;
}

function setView(id) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === id));
  document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === id));
  $("#page-title").textContent = {
    dashboard: "Payroll & Contributor Payouts",
    batch: "Batch Payout",
    split: "Split Payout",
    history: "History",
  }[id] || "Payroll & Contributor Payouts";
}

document.querySelectorAll("[data-view], [data-view-link]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view || button.dataset.viewLink));
});

async function ensureGiwa() {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (chainId.toLowerCase() === GIWA.chainIdHex) return;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: GIWA.chainIdHex }] });
  } catch (error) {
    if (error.code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: GIWA.chainIdHex,
        chainName: "GIWA Sepolia",
        rpcUrls: [GIWA.rpcUrl],
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        blockExplorerUrls: [GIWA.explorer],
      }],
    });
  }
}

function erc20(token) {
  return new E.Contract(tokenAddress(token), ERC20_ABI, state.signer);
}

function batchContract() {
  return new E.Contract(GIWA.contracts.BatchTransfer, BATCH_ABI, state.signer);
}

async function connectWallet() {
  if (!window.ethereum) throw new Error("Open this page in a browser with MetaMask enabled.");
  if (!window.ethers) throw new Error("Ethers failed to load. Check internet/CDN access or use the hosted build.");
  await ensureGiwa();
  state.provider = new E.BrowserProvider(window.ethereum);
  state.signer = await state.provider.getSigner();
  state.account = await state.signer.getAddress();
  $("#connect-wallet").textContent = shortAddress(state.account);
  $("#disconnect-wallet").classList.remove("hidden");
  localStorage.setItem("divvypay-auto-connect", "true");
  await refreshChainState();
}

function disconnectWallet() {
  state.account = "";
  state.provider = null;
  state.signer = null;
  state.balances = { USDC: 0n, KRW: 0n };
  state.allowances = { USDC: 0n, KRW: 0n };
  localStorage.removeItem("divvypay-auto-connect");
  $("#connect-wallet").textContent = "Connect MetaMask";
  $("#disconnect-wallet").classList.add("hidden");
  showToast("Wallet disconnected from this app.");
  updateBalances();
}

async function refreshChainState() {
  $("#wallet-short").textContent = shortAddress(state.account);
  if (!state.account || !state.signer) {
    updateBalances();
    return;
  }
  const reads = [
    ["USDC balance", async () => { state.balances.USDC = await erc20("USDC").balanceOf(state.account); }],
    ["KRW balance", async () => { state.balances.KRW = await erc20("KRW").balanceOf(state.account); }],
    ["USDC allowance", async () => { state.allowances.USDC = await erc20("USDC").allowance(state.account, GIWA.contracts.BatchTransfer); }],
    ["KRW allowance", async () => { state.allowances.KRW = await erc20("KRW").allowance(state.account, GIWA.contracts.BatchTransfer); }],
  ];

  const failures = [];
  for (const [label, read] of reads) {
    try {
      await read();
    } catch (error) {
      failures.push(`${label}: ${error.shortMessage || error.message || "read failed"}`);
    }
  }

  updateBalances();
  if (failures.length) {
    showToast(`Some chain reads failed. ${failures[0]}`);
  }
}

function updateBalances() {
  $("#wallet-short").textContent = shortAddress(state.account);
  $("#usdc-balance").textContent = Number(E.formatUnits(state.balances.USDC, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $("#krw-balance").textContent = Number(E.formatUnits(state.balances.KRW, 6)).toLocaleString(undefined, { maximumFractionDigits: 0 });
  updateBatchPreview();
  updateSplitPreview();
  updateMetrics();
}

$("#connect-wallet").addEventListener("click", async () => {
  try {
    await connectWallet();
    showToast("Wallet connected on GIWA Sepolia.");
  } catch (error) {
    showToast(error.shortMessage || error.message || "Wallet connection failed.");
  }
});

$("#disconnect-wallet").addEventListener("click", disconnectWallet);

async function mint(token, amount) {
  if (!state.account) await connectWallet();
  const tx = await erc20(token).mint(state.account, parseAmount(amount));
  showToast(`Mint sent: ${shortAddress(tx.hash)}.`);
  await tx.wait();
  showToast(`${tokenLabel(token)} mint confirmed. Refreshing balances...`);
  addHistory("Faucet", tokenLabel(token), Number(amount), 1, tx.hash);
  await refreshChainState();
}

$("#mint-usdc").addEventListener("click", () => mint("USDC", "10000").catch((e) => showToast(e.shortMessage || e.message || "Mint failed.")));
$("#mint-krw").addEventListener("click", () => mint("KRW", "1000000").catch((e) => showToast(e.shortMessage || e.message || "Mint failed.")));

const batchInput = $("#batch-input");
const sendBatchButton = $("#send-batch");
batchInput.value = sampleCsv;

function parseCsv() {
  const lines = batchInput.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hasHeader = lines[0]?.toLowerCase().startsWith("address,");
  return (hasHeader ? lines.slice(1) : lines).map((line, index) => {
    const [address = "", amount = "", label = ""] = line.split(",").map((part) => part.trim());
    let amountRaw = 0n;
    try {
      amountRaw = parseAmount(amount);
    } catch {}
    return {
      line: index + 1 + (hasHeader ? 1 : 0),
      address,
      amount,
      amountRaw,
      label,
      validAddress: /^0x[a-fA-F0-9]{40}$/.test(address),
      validAmount: amountRaw > 0n,
    };
  }).filter((row) => row.address || row.amount || row.label);
}

function getBatchState() {
  const token = $("#batch-token").value;
  const rows = parseCsv();
  const validRows = rows.filter((row) => row.validAddress && row.validAmount);
  const total = validRows.reduce((sum, row) => sum + row.amountRaw, 0n);
  const errors = rows.filter((row) => !row.validAddress || !row.validAmount);
  return {
    token,
    rows,
    validRows,
    total,
    hasErrors: errors.length > 0,
    firstError: errors[0],
    balanceTooLow: total > state.balances[token],
    allowanceEnough: total > 0n && state.allowances[token] >= total,
  };
}

function updateBatchPreview() {
  const batch = getBatchState();
  $("#batch-preview").innerHTML = batch.validRows.map((row, index) => `<tr>
    <td>${index + 1}</td><td>${shortAddress(row.address)}</td><td>${row.label || "Unlabeled"}</td><td>${formatRaw(row.amountRaw, batch.token)}</td>
  </tr>`).join("") || `<tr><td colspan="4">No valid recipients yet.</td></tr>`;
  $("#batch-count").textContent = batch.validRows.length;
  $("#batch-total").textContent = formatRaw(batch.total, batch.token);
  $("#batch-approval").textContent = formatRaw(batch.total, batch.token);
  $("#batch-available").textContent = formatRaw(state.balances[batch.token], batch.token);
  const errorBox = $("#batch-error");
  errorBox.classList.toggle("hidden", !batch.hasErrors && !batch.balanceTooLow);
  errorBox.textContent = batch.hasErrors
    ? `Line ${batch.firstError.line}: ${!batch.firstError.validAddress ? "invalid recipient address" : "amount must be greater than 0"}. Sending is disabled until every row is valid.`
    : batch.balanceTooLow ? `Insufficient balance: ${formatRaw(batch.total, batch.token)} required.` : "";
  const status = $("#batch-status");
  if (!state.account) {
    status.textContent = "Connect MetaMask first.";
    status.style.color = "var(--warning)";
    setButton(sendBatchButton, false, "Connect Wallet");
  } else if (batch.hasErrors) {
    status.textContent = "Fix invalid rows before sending.";
    status.style.color = "var(--danger)";
    setButton(sendBatchButton, true, "Fix Invalid Rows");
  } else if (!batch.validRows.length) {
    status.textContent = "Add at least one valid recipient.";
    status.style.color = "var(--warning)";
    setButton(sendBatchButton, true, `Approve ${tokenLabel(batch.token)}`);
  } else if (batch.balanceTooLow) {
    status.textContent = "Balance must cover payout total.";
    status.style.color = "var(--warning)";
    setButton(sendBatchButton, true, "Insufficient Balance");
  } else if (!batch.allowanceEnough) {
    status.textContent = "Step 1 of 2: approve token allowance.";
    status.style.color = "var(--warning)";
    setButton(sendBatchButton, false, `Approve ${tokenLabel(batch.token)}`);
  } else {
    status.textContent = "Step 2 of 2: send batch payout.";
    status.style.color = "var(--success)";
    setButton(sendBatchButton, false, "Send Batch Payout");
  }
}

batchInput.addEventListener("input", updateBatchPreview);
$("#batch-token").addEventListener("change", updateBatchPreview);
$("#load-sample").addEventListener("click", () => { batchInput.value = sampleCsv; updateBatchPreview(); });
$("#add-row").addEventListener("click", () => { batchInput.value = `${batchInput.value.trim()}\n0x0000000000000000000000000000000000000000,100,New recipient`.trim(); updateBatchPreview(); });
$("#clear-batch").addEventListener("click", () => { batchInput.value = ""; updateBatchPreview(); });
$("#csv-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  batchInput.value = await file.text();
  updateBatchPreview();
});

async function approve(token, amount) {
  const tx = await erc20(token).approve(GIWA.contracts.BatchTransfer, amount);
  showToast(`Approval sent: ${shortAddress(tx.hash)}.`);
  await tx.wait();
  await refreshChainState();
}

sendBatchButton.addEventListener("click", async () => {
  try {
    if (!state.account) return connectWallet();
    const batch = getBatchState();
    if (batch.hasErrors || batch.balanceTooLow || !batch.validRows.length) return;
    if (!batch.allowanceEnough) return approve(batch.token, batch.total);
    const tx = await batchContract().batchTransfer(tokenAddress(batch.token), batch.validRows.map((r) => normalizeAddress(r.address)), batch.validRows.map((r) => r.amountRaw));
    showToast(`Batch payout sent: ${shortAddress(tx.hash)}.`);
    await tx.wait();
    addHistory("Batch Payout", tokenLabel(batch.token), Number(E.formatUnits(batch.total, 6)), batch.validRows.length, tx.hash);
    await refreshChainState();
  } catch (error) {
    showToast(error.shortMessage || error.message || "Batch payout failed.");
  }
});

const splitRows = $("#split-rows");
const sendSplitButton = $("#send-split");

function addSplitRow(address = "", ratio = 50) {
  const row = document.createElement("div");
  row.className = "split-row";
  row.innerHTML = `<label>Recipient address<input class="split-address" value="${address}" placeholder="0x..." /></label>
    <label>Ratio %<input class="split-ratio-input" type="number" min="0" max="100" value="${ratio}" /></label>
    <button type="button">x</button>`;
  row.querySelector("button").addEventListener("click", () => { row.remove(); updateSplitPreview(); });
  row.querySelectorAll("input").forEach((input) => input.addEventListener("input", updateSplitPreview));
  splitRows.appendChild(row);
  updateSplitPreview();
}

function getSplitState() {
  const token = $("#split-token").value;
  const total = parseAmount($("#split-total-input").value);
  const rows = [...document.querySelectorAll(".split-row")].map((row) => ({
    address: normalizeAddress(row.querySelector(".split-address").value),
    ratio: Number(row.querySelector(".split-ratio-input").value) || 0,
  }));
  const ratioTotal = rows.reduce((sum, row) => sum + row.ratio, 0);
  const ratios = rows.map((row) => BigInt(Math.round(row.ratio * 100)));
  let allocated = 0n;
  const dist = rows.map((row, index) => {
    const amount = index === rows.length - 1 ? total - allocated : (total * ratios[index]) / 10000n;
    allocated += amount;
    return { ...row, amount, ratioRaw: ratios[index], receivesRemainder: index === rows.length - 1 };
  });
  return { token, total, rows, ratios, dist, ratioTotal, balanceTooLow: total > state.balances[token], allowanceEnough: total > 0n && state.allowances[token] >= total };
}

function updateSplitPreview() {
  const split = getSplitState();
  $("#split-count").textContent = split.rows.length;
  $("#split-ratio").textContent = `${split.ratioTotal}%`;
  $("#split-total").textContent = formatRaw(split.total, split.token);
  $("#split-preview").innerHTML = split.dist.map((row) => `<div class="mini-item">
    <div><strong>${shortAddress(row.address)}</strong><br><span>${row.ratio}% share${row.receivesRemainder ? " - final recipient receives remainder" : ""}</span></div>
    <strong>${formatRaw(row.amount, split.token)}</strong>
  </div>`).join("") || `<div class="mini-item"><span>No recipients yet.</span></div>`;
  const status = $("#split-status");
  if (!state.account) {
    status.textContent = "Connect MetaMask first.";
    status.style.color = "var(--warning)";
    setButton(sendSplitButton, false, "Connect Wallet");
  } else if (split.ratioTotal !== 100) {
    status.textContent = "Ratio must equal 100%.";
    status.style.color = "var(--warning)";
    setButton(sendSplitButton, true, "Fix Ratio Total");
  } else if (split.balanceTooLow) {
    status.textContent = "Balance must cover split total.";
    status.style.color = "var(--warning)";
    setButton(sendSplitButton, true, "Insufficient Balance");
  } else if (!split.allowanceEnough) {
    status.textContent = "Step 1 of 2: approve token allowance.";
    status.style.color = "var(--warning)";
    setButton(sendSplitButton, false, `Approve ${tokenLabel(split.token)}`);
  } else {
    status.textContent = "Step 2 of 2: confirm split payout.";
    status.style.color = "var(--success)";
    setButton(sendSplitButton, false, "Confirm Split Payout");
  }
}

$("#add-split-row").addEventListener("click", () => addSplitRow("", 0));
$("#split-token").addEventListener("change", updateSplitPreview);
$("#split-total-input").addEventListener("input", updateSplitPreview);
sendSplitButton.addEventListener("click", async () => {
  try {
    if (!state.account) return connectWallet();
    const split = getSplitState();
    if (split.ratioTotal !== 100 || split.balanceTooLow) return;
    if (!split.allowanceEnough) return approve(split.token, split.total);
    const tx = await batchContract().splitTransfer(tokenAddress(split.token), split.rows.map((r) => normalizeAddress(r.address)), split.ratios, split.total);
    showToast(`Split payout sent: ${shortAddress(tx.hash)}.`);
    await tx.wait();
    addHistory("Split Payout", tokenLabel(split.token), Number(E.formatUnits(split.total, 6)), split.rows.length, tx.hash);
    await refreshChainState();
  } catch (error) {
    showToast(error.shortMessage || error.message || "Split payout failed.");
  }
});

addSplitRow("0x71ce15c5a0f4b9d7217b8a7a2e6d9d3f55a9ce1", 60);
addSplitRow("0x43d3ec372cb6fc158d7bc78377042d01d3a3b790", 40);

function addHistory(type, token, total, recipients, hash) {
  state.history.unshift({ type, token, total, recipients, hash, time: new Date().toLocaleString() });
  state.history = state.history.slice(0, 24);
  localStorage.setItem("divvypay-history", JSON.stringify(state.history));
  renderHistory();
}

function updateMetrics() {
  const payouts = state.history.filter((item) => item.type.includes("Payout"));
  $("#metric-paid").textContent = `$${payouts.filter((item) => item.token === "MockUSDC").reduce((sum, item) => sum + Number(item.total), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  $("#metric-recipients").textContent = payouts.reduce((sum, item) => sum + item.recipients, 0);
  $("#metric-last").textContent = payouts[0]?.type || "No payout activity";
}

function renderHistoryItem(item) {
  return `<div class="history-item">
    <div><strong>${item.type}</strong><br><span>${item.time} - ${item.recipients} recipient${item.recipients > 1 ? "s" : ""}</span></div>
    <div><strong>${Number(item.total).toLocaleString()} ${item.token}</strong><br><a href="${explorerTx(item.hash)}" target="_blank" rel="noreferrer">${shortAddress(item.hash)}</a></div>
  </div>`;
}

function renderHistory() {
  const payouts = state.history.filter((item) => item.type !== "Faucet");
  const faucets = state.history.filter((item) => item.type === "Faucet");
  $("#history-list").innerHTML =
    (payouts.length ? payouts.map(renderHistoryItem).join("") : `<div class="history-item"><span>No payout transactions yet.</span></div>`) +
    (faucets.length ? `<details class="history-group"><summary><strong>Faucet records</strong><span>${faucets.length} mint${faucets.length > 1 ? "s" : ""}</span></summary>${faucets.map(renderHistoryItem).join("")}</details>` : "");
  updateMetrics();
}

$("#clear-history").addEventListener("click", () => {
  state.history = [];
  localStorage.removeItem("divvypay-history");
  renderHistory();
});

if (window.ethereum?.on) {
  window.ethereum.on("accountsChanged", async () => connectWallet().catch(() => {}));
  window.ethereum.on("chainChanged", () => window.location.reload());
}

renderHistory();
updateBalances();

if (localStorage.getItem("divvypay-auto-connect") === "true" && window.ethereum && window.ethers) {
  connectWallet().catch(() => {
    localStorage.removeItem("divvypay-auto-connect");
  });
}
