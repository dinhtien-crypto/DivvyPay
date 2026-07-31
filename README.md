# DivvyPay

**One transaction for batch payout and proportional split on GIWA.**

DivvyPay is a stablecoin payout workspace deployed on the GIWA Sepolia testnet. It helps teams, companies, and projects send stablecoin payments to multiple recipients or split revenue by percentage in a single on-chain transaction.

GIWA's low gas and fast confirmation make batch payouts and multi-party settlement more practical, while the MockKRW flow prepares the product for future KRW stablecoin use cases.

## Core Features

- **Batch Payout**  
  Add recipients manually or upload a CSV file, then pay multiple addresses with one transaction.

- **Split Payout**  
  Enter a total amount and assign percentage shares. The final recipient receives any integer rounding remainder so the total payout remains exact.

- **Two Mock Stablecoins**  
  `MockUSDC` for global USD-denominated payouts.  
  `MockKRW` for Korea-facing KRW-denominated payout flows.

- **Test Token Faucet**  
  Mint demo tokens directly from the dashboard for testing and presentations.

- **Transaction History**  
  Records Batch and Split actions locally, with explorer links for completed transactions.

## Product Positioning

DivvyPay starts with two practical payout problems:

- **Batch payments are repetitive**  
  Instead of sending rewards or salaries one by one, users can add many recipients or upload a CSV and complete the payout in one transaction.

- **Percentage-based splits are error-prone**  
  Users can enter a total amount and percentage shares, while DivvyPay calculates the final distribution and handles rounding safely.

## Example Use Cases

- Contributor rewards for Web3 projects
- Team bonuses or internal payouts
- Revenue sharing among collaborators
- Local KRW-denominated payout demos on GIWA
- Global USDC-denominated contributor payments

## Smart Contracts

| Contract | Description |
| --- | --- |
| `MockUSDC.sol` | 6-decimal mock USD stablecoin with public `mint(address,uint256)` |
| `MockKRW.sol` | 6-decimal mock KRW stablecoin with public `mint(address,uint256)` |
| `BatchTransfer.sol` | ERC20 batch payout and proportional split payout contract |

## Deployed Contracts on GIWA Sepolia

| Contract | Address |
| --- | --- |
| MockUSDC | `0x69D13EaeA37866e196D1d1B9185e7e534f5fc2cC` |
| MockKRW | `0xaEFDBeaE2d1b140F366da7CB8f075AD5956E3751` |
| BatchTransfer | `0x9Ad98ED6936A6bbC0e6364FF4DA088c043d71711` |

## Split Ratio Rules

`splitTransfer` uses basis points:

```text
10_000 = 100%
6_000  = 60%
4_000  = 40%
```

The final recipient receives any integer rounding remainder, ensuring the transferred total always equals the user's input amount.

## Demo Flow

1. Connect MetaMask and switch to GIWA Sepolia.
2. Mint `MockUSDC` or `MockKRW` from the dashboard.
3. Open Batch Payout or Split Payout.
4. Approve the selected token for `BatchTransfer`.
5. Execute the payout transaction.
6. Review the transaction in History and open the GIWA explorer link.

## Frontend

The current MVP frontend is in:

```text
work/
```

It is a static HTML/CSS/JavaScript app and can be served locally:

```powershell
cd work
python -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

## Future Extensions

DivvyPay is designed to grow beyond the MVP and become a more complete, mature payment infrastructure workspace.

Potential extensions include:

- Payment links and payment requests
- Multi-asset swap flows, including ETH and stablecoins
- Recurring batch payments for subscriptions and payroll cycles
- Recipient management and payout templates
- Improved transaction history and export
- Support for future official KRW stablecoin infrastructure
- Broader payment workflows for teams, companies, and contributors on GIWA

## License

MIT
