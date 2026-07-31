# DivvyPay Contracts

MVP contracts for GIWA Sepolia.

## Contracts

- `MockUSDC.sol`: 6-decimal mock USD stablecoin with public `mint(address,uint256)`.
- `MockKRW.sol`: 6-decimal mock KRW stablecoin with public `mint(address,uint256)`.
- `BatchTransfer.sol`: one-transaction ERC20 batch payout and proportional split payout.

## Split Ratios

`splitTransfer` uses basis points:

- `10_000` = 100%
- `6_000` = 60%
- `4_000` = 40%

The last recipient receives any integer rounding remainder.

## Demo Mint Amounts

Because both mock tokens use 6 decimals:

- Mint 10,000 MockUSDC: `10000 * 10 ** 6`
- Mint 1,000,000 MockKRW: `1000000 * 10 ** 6`

## Deploy Order

1. Deploy `MockUSDC`
2. Deploy `MockKRW`
3. Deploy `BatchTransfer`
4. Verify all three contracts on the GIWA explorer
5. Put the verified explorer URLs into the GASOK form
