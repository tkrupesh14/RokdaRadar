# Contributing to RokdaRadar

Thanks for wanting to contribute. This project is a transparency layer for disaster relief
donations — money moves via UPI as it always has, and only the proof (every receipt, every rupee
spent) is recorded on Monad. That framing matters for how we work: **never claim something works,
is verified, or is real when it isn't.** The codebase's own convention is to label mock/partial
data as exactly that (see `STATUS.md`, and comments throughout `backend/src/` calling out which
pieces are still an "MVP0 tier" stand-in for a real integration) rather than let a shortcut look
finished. Follow that convention in your own changes.

## Getting started

Follow [README.md](README.md) to install both apps and set up `backend/.env`. The short version:

```bash
npm install                       # repo root: installs + builds the backend
cd frontend && npm install
cd ../backend && cp .env.example .env   # fill in the secrets described there
```

`./dev.sh` at the repo root boots both apps together for local development.

## Before you start work

- **Check the issue tracker first.** Issues are labeled by `priority: P0-critical` through
  `P3-low` and by `area: *` (security, trust-score, csr, evidence-storage, network-intelligence,
  compliance-legal, infra, observability, testing, payments). If you're picking up existing work,
  read the issue's full description — several have an explicit **Depends on** note; build that
  dependency first, or coordinate so your PR doesn't land in the wrong order.
- **Read `STATUS.md`** before assuming something is implemented. It's kept in sync with what the
  code actually does, not what the design docs describe — the design docs
  (`ReliefTrace_HLD.md` / `ReliefTrace_LLD.md`) are the spec being implemented against, not a
  changelog of what's done.
- **If a task's scope is ambiguous or depends on infrastructure/credentials you don't have**
  (a second database, a payment provider account, a pinning service account), say so in the PR
  rather than guessing or faking the result. It's fine to ship something credential-gated (an env
  var that defaults to today's behavior when unset) with mocked-only test coverage, as long as
  that's stated plainly, not implied to be verified when it isn't.

## Branching and commits

- Branch off `dev`, not `main`. PRs target `dev`.
- Branch name: `fix/<issue-number>-<short-slug>` (e.g. `fix/19-rate-limit-abuse-protection`) when
  a branch maps to one issue. Use whatever's clear if it doesn't.
- Commit messages: a short summary line, then a body explaining **why**, not just what changed —
  the diff already shows what changed. Reference the issue number. Look at recent commits
  (`git log`) for the tone this repo actually uses.
- Only commit real, working changes — no commented-out code, no half-finished features behind a
  TODO. If something's out of scope, say so in the PR description and leave it for a follow-up
  issue instead of stubbing it in.

## Code style

- Match the file you're editing. This repo has a consistent voice: comments explain *why*
  (a non-obvious constraint, a workaround, an invariant), never *what* (the code already says
  that). Don't add comments that just restate the next line.
- No premature abstraction. Three similar lines beat a speculative helper built for a
  hypothetical second use case that doesn't exist yet.
- Don't add error handling, fallbacks, or config toggles for scenarios that can't happen. Trust
  the framework and your own code's guarantees; validate only at real boundaries (user input,
  external APIs).
- New optional integrations (a payment provider, a storage backend, an AI provider) should follow
  the pattern already used for the AI provider config: **gated behind an env var that defaults to
  today's behavior when unset**, so the feature ships additively and never breaks anyone who
  hasn't configured it. See `AI_PROVIDER` in `backend/src/config/env.ts` for the existing example.
- Secrets are never hardcoded and never committed. `backend/.env` is gitignored; only
  `.env.example` (with empty/placeholder values) is tracked. If you add a new required secret,
  add its placeholder line to `.env.example` too, with a comment on where to get it.

## Testing

- Backend: `cd backend && npm test` (Vitest). **Most backend tests require `TEST_DATABASE_URL`**
  — a real Postgres database, physically separate from `DATABASE_URL` (a second Supabase project,
  or any scratch Postgres instance both work). Without it, DB-backed tests fail loudly with a
  clear message rather than silently running against production data; that's a known, separately
  tracked gap (issue #14), not something to route around. Tests that don't touch the database
  (crypto/HMAC logic, request validation, PDF/XLSX rendering, mocked-HTTP integration clients) run
  fine without it — check whether your test actually needs a live DB before assuming it can't run.
- Frontend: `cd frontend && npm run build` and `npx tsc --noEmit` are the fast checks. If
  `frontend/e2e/` exists (Playwright smoke tests), run `npx playwright install --with-deps
  chromium` once, then `npm run test:e2e` — they mock their own backend responses, so they don't
  need a database.
- Contracts: `cd backend && npm run contracts:test` (Hardhat).
- Run `npx tsc --noEmit` in whichever app you changed before opening a PR, even if you can't run
  the full test suite locally. `backend`'s `npm run lint` script exists but has no ESLint config
  yet (a known gap) — `tsc` is the real check there for now. `frontend`'s lint is real
  (`npm run lint`, flat config in `eslint.config.mjs`) — run it.
- If you can't run something locally (no test database, no provider credentials, no way to
  complete a live payment flow), say exactly that in the PR rather than only listing what passed.
  Live-verifying against real (test-mode) infrastructure when you have credentials for it —
  e.g. an actual API call to a real provider, not just a mock — is worth doing and worth
  mentioning explicitly when you do.

## Pull requests

- Target `dev`. Reference the issue you're closing (`Closes #N` / `Fixes #N`) so it closes
  automatically on merge.
- CI (`.github/workflows/pr-checks.yml`) builds both apps and requests a Copilot review; it
  doesn't run the test suites yet (see issue #15). That means a clean CI run is necessary but not
  sufficient — actually run the relevant tests/typecheck locally per the Testing section above.
- Describe what you verified and how, including anything you *couldn't* verify and why (missing
  credentials, no test database, etc.) — reviewers should be able to tell real verification from
  "it should work."
- Keep PRs scoped to one issue/change where reasonable. If you find something else worth fixing
  along the way, it's fine to open a separate issue for it rather than scope-creeping the PR.

## Reporting issues

Use the existing labels: `priority: P0-critical` (blocks safe operation or development) through
`priority: P3-low` (nice to have), and an `area: *` label for the relevant subsystem. Say what
roadmap phase it belongs to if you know (the design docs use MVP0/1/2/3/4 phases), and link any
issue it depends on or blocks.

## Security

If you find a security issue that could put real donor funds or PII at risk, don't post exploit
details in a public issue — reach out to a maintainer privately first. Otherwise, security-related
bugs that don't need coordinated disclosure are welcome as regular issues labeled
`area: security`.
