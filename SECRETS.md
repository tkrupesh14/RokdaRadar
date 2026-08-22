# Secrets and key management

Tracks issue #18 (area:security, P1). Covers what secrets this project has, how they're handled
today, and what changes before a production deployment.

## Inventory

| Secret | Where it's used | Blast radius if leaked |
|---|---|---|
| `OPERATOR_PRIVATE_KEY` | Signs `createCampaign` / `attestSpend` / `attestDelivery` (`backend/src/chain/provider.ts`) | Attacker can create fake campaigns, forge spend/delivery attestations |
| `ORACLE_PRIVATE_KEY` | Signs `attestDonation` (falls back to `OPERATOR_PRIVATE_KEY` if unset) | Attacker can forge donation attestations |
| `WEBHOOK_HMAC_SECRET` | Verifies `X-Webhook-Signature` on `POST /api/webhooks/upi` (`backend/src/auth/webhookHmac.ts`) | Attacker can forge PSP webhook calls, triggering `attestDonation` |
| `DATABASE_URL` / `TEST_DATABASE_URL` | Postgres/Supabase connection strings | Full read/write on campaign, spend, and donation records |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | AI report generation (`backend/src/ai/`) | Billing abuse on the provider account |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project id (`frontend/lib/wallet.ts`) | Low -- this is a public client identifier by design (it ships to the browser bundle), not a secret; WalletConnect Cloud scopes rate limits to it, so a leaked/guessed value only risks quota exhaustion, not fund/data access |

## Current state

- No secret is committed to the repo. `.gitignore` excludes `.env`/`.env.*` everywhere except the
  `*.example` templates, and `git ls-files | grep env` confirms only the example files are tracked.
- All non-public secrets are read from `process.env` via `backend/src/config/env.ts` (Postgres/dotenv
  pattern), so swapping the source of those env vars (e.g. injecting them from a secrets manager at
  process start instead of a `.env` file) requires no application code changes -- only how the process
  is launched changes.
- As of this issue, `backend/src/config/env.ts` refuses to boot with `NODE_ENV=production` if
  `WEBHOOK_HMAC_SECRET` is still the default dev placeholder, or if `ORACLE_PRIVATE_KEY` is unset while
  `OPERATOR_PRIVATE_KEY` is set (which would silently reuse the operator key for the oracle role). See
  `assertProductionSecretsAreSafe()`.

## Secrets manager migration plan

`.env` files are fine for local dev and the current single-operator testnet demo, but before a
production deployment with real funds/PII on the line:

1. **Pick a secrets manager tied to the hosting platform** -- e.g. AWS Secrets Manager or Parameter
   Store if deployed on AWS/ECS, Google Secret Manager on GCP/Cloud Run, or Doppler/Infisical if the
   host is platform-agnostic (Fly.io, Render, Railway, etc.). Pick whichever matches wherever this
   actually gets deployed; nothing here is provider-specific in the app.
2. **Inject secrets as process environment variables at container/process start**, not as files
   written to disk. `backend/src/config/env.ts` already only reads `process.env` -- no code changes
   needed on the app side, only the deploy pipeline (fetch from the secrets manager, export into the
   process environment, then start `node dist/index.js`).
3. **Restrict read access to the deploy pipeline's service identity only.** No human should be able to
   read production secrets directly from the manager in normal operation -- only break-glass access,
   logged and time-boxed.
4. **Keep `.env.example` / `.env.local.example` as the source of truth for which variables exist**,
   never for real values. Adding a new required secret means adding a line to these files too so the
   secrets manager's parameter set doesn't silently drift from what the app actually reads.

## Key rotation plan

| Secret | Rotation trigger | Procedure |
|---|---|---|
| `WEBHOOK_HMAC_SECRET` | Every 90 days, or immediately on suspected leak | Generate a new random secret, update it in the secrets manager, redeploy the backend, then update the PSP's webhook config to sign with the new secret. Because verification is a single `env.WEBHOOK_HMAC_SECRET` read with no dual-secret grace window today, this rotation currently requires a brief coordinated cutover with the PSP side (or a short maintenance window) rather than being zero-downtime -- add dual-secret verification (accept old-or-new for a rollover window) before relying on this rotating without downtime. |
| `OPERATOR_PRIVATE_KEY` | Every 180 days, or immediately on suspected leak | Fund a new address, call the contract's operator-role transfer (see `ReliefTraceIN.sol`) to grant the new address and revoke the old one on-chain, then update the secret and redeploy. This one is **not** a simple env-var swap -- the contract itself has to authorize the new address first, or attestations start reverting. |
| `ORACLE_PRIVATE_KEY` | Every 180 days, or immediately on suspected leak | Same as `OPERATOR_PRIVATE_KEY`: fund a new address, update the contract's oracle-role allowlist on-chain, then update the secret and redeploy. |
| `DATABASE_URL` (Postgres password) | Every 180 days, or immediately on suspected leak | Rotate the password in Supabase/Postgres, update the secret, redeploy. No on-chain coordination needed. |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | On provider's own rotation guidance, or immediately on suspected leak | Issue a new key from the provider console, update the secret, redeploy, then revoke the old key. |

Every rotation should be logged (who, when, why) even without full automation yet -- a shared rotation
log is enough at this stage; a scheduled reminder (calendar or CI job) is enough to enforce the cadence
until this is automated.

## Environment separation

Production must use secrets that are **not** shared with dev/staging:

- Separate `OPERATOR_PRIVATE_KEY` / `ORACLE_PRIVATE_KEY` per environment. The two roles must also be
  distinct addresses from each other in production (enforced at boot now, see above) -- the current
  single-key-for-both-roles setup is documented in `env.ts` as an explicit MVP0 demo simplification,
  not something to carry into production.
- Separate `WEBHOOK_HMAC_SECRET` per environment, so a staging leak can't be used to forge production
  webhook calls.
- Separate `DATABASE_URL` per environment (already true today -- `TEST_DATABASE_URL` must differ from
  `DATABASE_URL`, enforced by `backend/src/db/client.ts`).
- Separate AI provider keys per environment where the provider supports scoping/budget limits per key,
  so a runaway dev/staging process can't exhaust the production budget.

Whoever owns the production deploy should confirm the above against whatever keys are actually
provisioned before go-live -- this doc defines the policy the boot-time check enforces where it's
mechanically checkable (the HMAC secret and operator/oracle key separation), but cross-environment key
reuse can't be detected from inside a single running process, so it still needs a manual confirmation
pass across all environments' actual secret values.
