# Deploying DivvyPay on GIWA Sepolia

## Network

- Network: GIWA Sepolia
- Chain ID: `91342`

## Deploy Order

1. `MockUSDC`
2. `MockKRW`
3. `BatchTransfer`

## Remix Path

If you want the fastest path:

1. Open Remix.
2. Create the three files from `contracts/`.
3. Compile with Solidity `0.8.24`.
4. Connect MetaMask to GIWA Sepolia.
5. Deploy `MockUSDC`, `MockKRW`, then `BatchTransfer`.
6. Verify the three contracts on the GIWA block explorer.

## Foundry Path

After installing Foundry:

```powershell
$env:GIWA_SEPOLIA_RPC_URL="https://..."
$env:PRIVATE_KEY="0x..."
forge build
forge create contracts/MockUSDC.sol:MockUSDC --rpc-url $env:GIWA_SEPOLIA_RPC_URL --private-key $env:PRIVATE_KEY
forge create contracts/MockKRW.sol:MockKRW --rpc-url $env:GIWA_SEPOLIA_RPC_URL --private-key $env:PRIVATE_KEY
forge create contracts/BatchTransfer.sol:BatchTransfer --rpc-url $env:GIWA_SEPOLIA_RPC_URL --private-key $env:PRIVATE_KEY
```

## Frontend Values

After deployment, the frontend needs:

- `MockUSDC` address
- `MockKRW` address
- `BatchTransfer` address
- GIWA explorer base URL

## Common Amounts

Both mock tokens use 6 decimals:

- `10,000 MockUSDC` = `10000000000`
- `1,000,000 MockKRW` = `1000000000000`
