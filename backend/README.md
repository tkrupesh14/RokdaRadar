# ReliefTrace Backend (MVP-0)

Express + TypeScript API, SQLite indexer, and Hardhat/Solidity contract for ReliefTrace's
backend, implementing `ReliefTrace_HLD.md` / `ReliefTrace_LLD.md` (repo root) MVP-0 scope.

## Setup

```bash
npm install
cd contracts && npm install && cd ..
cp .env.example .env
```

Fill in `.env`:
- `OPERATOR_PRIVATE_KEY` — a funded Monad testnet private key. Required to deploy the
  contract and to sign `attestSpend`/`createCampaign`/`attestDelivery` transactions.
  Also used as `ORACLE_PRIVATE_KEY` by default (one key plays both roles for MVP0).
- `ANTHROPIC_API_KEY` — required for the AI report endpoints. Everything else in the API
  works without it; `GET /api/campaigns/:id/report` returns `503 AI_SERVICE_UNAVAILABLE`
  until it's set.

## Running without any secrets

```bash
npm run contracts:test   # Solidity tests against local Hardhat network
npm test                 # indexer/aggregate/anomaly/guardrail/API/evidence suites
npm run dev               # boots the API; chain-dependent routes degrade cleanly
```

Visit `http://localhost:4000/docs` for interactive Swagger UI, `http://localhost:4000/health`
for subsystem status.

## Deploying to Monad testnet (requires `OPERATOR_PRIVATE_KEY`)

```bash
npm run contracts:compile
npm run contracts:deploy:testnet
# copy the printed CONTRACT_ADDRESS into .env
```

Restart `npm run dev` afterwards — the indexer only starts once `CONTRACT_ADDRESS` and
`OPERATOR_PRIVATE_KEY` are both present.

## Testing signed routes without a frontend wallet

```bash
npx tsx scripts/signOperatorRequest.ts <privateKey> "POST /api/campaigns"
npx tsx scripts/signOperatorRequest.ts <privateKey> "POST /api/campaigns/:id/spend" 1
```

Paste the resulting `{address, nonce, timestamp, signature}` into the request body's
`auth`/`authAddress`+`authNonce`+`authTimestamp`+`authSignature` fields from Swagger UI.

## Simulating a UPI payment (mocked PSP)

```bash
npx tsx scripts/simulateUpiWebhook.ts 1 50000
```

## Directory layout

- `contracts/` — standalone Hardhat project (`ReliefTraceIN.sol`, tests, deploy script)
- `src/db/` — SQLite schema, migration, repositories
- `src/indexer/` — event listener, idempotent handlers, deterministic aggregate + anomaly rules
- `src/ai/` — prompt builder, Anthropic client, guardrail validation, report cache
- `src/routes/` — Express routes, one file per resource, annotated with swagger-jsdoc
- `src/openapi/` — OpenAPI component schemas + swagger-jsdoc config, served at `/docs`
- `test/` — vitest suites (no secrets required)
