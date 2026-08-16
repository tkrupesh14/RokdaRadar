# RokdaRadar

A transparency layer for disaster relief donations: money moves via UPI as it always has, and only the
proof — every receipt, every rupee spent — is recorded on Monad. No cryptocurrency changes hands.

- **Live app:** [https://rokdaradar.krpex.in/](https://rokdaradar.krpex.in/)
- **Contract (Monad testnet):** [`0x31a10B1866f03B6A7e3497D7D5B71a97b7C64a3D`](https://testnet.monadscan.com/address/0x31a10B1866f03B6A7e3497D7D5B71a97b7C64a3D)

The repo has two apps plus the on-chain contract:

- `backend/` — Express + TypeScript API, SQLite indexer, and Hardhat/Solidity contract (see
  [backend/README.md](backend/README.md))
- `frontend/` — Next.js (App Router, TypeScript) product surfaces (see
  [frontend/README.md](frontend/README.md))
- `ReliefTrace_HLD.md` / `ReliefTrace_LLD.md` — high-level and low-level design docs the implementation follows

## Prerequisites

- Node.js (LTS) and npm
- A funded Monad testnet private key and an AI provider key (Gemini or Anthropic) if you want the
  chain-dependent and AI report features — everything else runs without secrets

## Installation

Clone the repo, then install dependencies for both apps in one step from the repo root:

```bash
npm install
```

This runs `postinstall`, which installs the backend's dependencies and builds it. Install the frontend
separately:

```bash
cd frontend && npm install
```

Then set up the backend's environment file:

```bash
cd backend
cp .env.example .env
```

Fill in `.env` with at least:
- `OPERATOR_PRIVATE_KEY` — a funded Monad testnet private key, required to deploy the contract and sign
  `attestSpend`/`createCampaign`/`attestDelivery` transactions (also used as `ORACLE_PRIVATE_KEY` by default)
- `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY`) — required for the AI report endpoints; `AI_PROVIDER` picks
  which one is used

Everything else in the API works without these — see [backend/README.md](backend/README.md) for details.

## Running

The `dev.sh` script at the repo root boots both apps together, installing dependencies and copying
`.env.example` automatically on first run if you skip the manual steps above:

```bash
./dev.sh
```

- Backend: `http://localhost:4000` (Swagger docs at `/docs`, health check at `/health`)
- Frontend: `http://localhost:3000`

Press `Ctrl+C` to stop both. Logs are written to `.dev-logs/backend.log` and `.dev-logs/frontend.log`.

To run either app on its own, see the per-app instructions in [backend/README.md](backend/README.md) and
[frontend/README.md](frontend/README.md).
