# Rite

A fixed-rate DeFi protocol on Ritual Chain. Three things: swap tokens, stake them for guaranteed yields, and borrow against the protocol at a flat rate.

## What it does

**Swap** -- Trade RIT, USDC, and DAI at a fixed 1:10 ratio (1 RIT = 10 USDC = 10 DAI). There is no price impact and no oracle. A 0.3% fee goes back to the pool.

**Stake** -- Lock any supported token for 12 hours to one week. USDC and DAI earn 5% to 25% depending on duration. RIT earns 50% to 250%, paid out in USDC.

**Lend** -- Borrow USDC or DAI at a flat 5% interest rate. No collateral, no liquidation risk. The idea is that your staking yield covers the loan cost.

## Deployed contracts (Ritual Testnet, Chain ID 1979)

| Contract     | Address                                      |
|--------------|----------------------------------------------|
| RIT Token    | `0xB3c243DE2B5EF41ccd2108D6d09B0e26a5EE9855` |
| Mock USDC    | `0x980c6AaC383bA7b2BAD37B702295120b2146B1eA` |
| Mock DAI     | `0xD171012b19c02B1dEC40f98C1d4B09Cc4e78dB32` |
| RiteSwap     | `0x6094e1d7155A2cc9c26c74b35a9a06AcCE7d3963` |
| RiteStaking  | `0x8978415Cd4Fa9668Dd4B8747c2De041841d4f87E` |
| RiteLending  | `0x0F5F9878f96808f208F86A176030178426930bDB` |

RPC: `https://rpc.ritualfoundation.org`

## Getting started

### Prerequisites

- [Foundry](https://book.getfoundry.sh/) for contract development
- Node 18+ and npm for the frontend
- A wallet with testnet ETH on Ritual (Chain ID 1979)

### Run the frontend locally

```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173` and connect your wallet. Add Ritual Testnet to MetaMask with RPC `https://rpc.ritualfoundation.org` and Chain ID `1979`.

Use the faucet button on the Swap page to get test tokens.

### Run contract tests

```bash
cd contracts
forge test -vv
```

49 tests, all passing (47 unit, 2 fuzz).

### Deploy contracts

Copy `.env.example` to `.env` and fill in your private key, then:

```bash
cd contracts
source ../.env
forge script script/Deploy.s.sol --rpc-url ritual --broadcast
```

After deployment, update `frontend/src/constants/contracts.ts` with the new addresses.

## Staking rates

| Duration | USDC / DAI | RIT (paid in USDC) |
|----------|------------|--------------------|
| 12 hours | 5%         | 50%                |
| 24 hours | 10%        | 100%               |
| 48 hours | 15%        | 150%               |
| 72 hours | 20%        | 200%               |
| 1 week   | 25%        | 250%               |

## Project layout

```
igara-build/
|-- contracts/          Solidity contracts (Foundry)
|   |-- src/
|   |   |-- tokens/     RITToken, MockUSDC, MockDAI
|   |   |-- RiteSwap.sol
|   |   |-- RiteStaking.sol
|   |   |-- RiteLending.sol
|   |-- script/         Deploy.s.sol
|   |-- test/           Unit + fuzz tests
|-- frontend/           React + Vite + Tailwind + wagmi v2
|   |-- src/
|   |   |-- constants/  Addresses, ABIs, chain config
|   |   |-- components/ Nav, Logo, ChainGuard, ConnectButton
|   |   |-- pages/      Landing, Swap, Stake, Lend
```

## Tech stack

- Solidity 0.8.20 + OpenZeppelin v5
- Foundry (forge) for testing and deployment
- React 18 + TypeScript + Vite
- wagmi v2 + viem for contract interaction
- Tailwind CSS v3

## License

MIT
