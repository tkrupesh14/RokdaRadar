# RokdaRadar — Status

What's actually built versus what `ReliefTrace_HLD.md` / `ReliefTrace_LLD.md` describe, verified against
the code (not the docs' intent). Last updated 2026-08-21.

## By MVP phase

### MVP 0 — core system: done

| Component | Status | Evidence |
|---|---|---|
| Smart contract | ✅ Done | `backend/contracts/contracts/ReliefTraceIN.sol` — `createCampaign`, `attestDonation`, `attestSpend`, `attestDelivery`, `closeCampaign`, full event set, hardhat test suite |
| Indexer | ✅ Done | `backend/src/db/schema.sql` (campaigns/donations/spends/delivery_attestations/processed_events tables), `backend/src/indexer/handlers.ts` + `listener.ts` with idempotent event processing |
| API layer | ✅ Done | Real Express routes: `campaigns.ts`, `spend.ts`, `donate.ts`, `feed.ts`, `aggregate.ts`, `report.ts`, `pendingSpends.ts`, `delivery.ts`, `webhooks.ts`, OpenAPI docs at `/docs` |
| Intelligence/AI service | ✅ Done | `backend/src/ai/reportService.ts`, `guardrail.ts`, `cache.ts`, `promptBuilder.ts` — Anthropic/Gemini-backed, rate-limited `/refresh` |
| Evidence storage | ✅ Done (real IPFS available, local remains the default) | `backend/src/evidence/storage.ts` — `EVIDENCE_STORAGE_BACKEND=ipfs` pins to Pinata (`backend/src/evidence/pinataClient.ts`) for a real, durable CID; `local` (default) keeps the filesystem+SHA-256 MVP0 tier for dev/demo. **Not verified against a live Pinata account** — no credentials were available in the environment this was built in; covered by tests that mock the Pinata HTTP call, not a real end-to-end pin. A redundant second-provider pin (LLD Section 6 asks for one) isn't implemented yet, for the same reason. |

### MVP 1+ — payment domain: mocked, reconciliation live

| Component | Status | Evidence |
|---|---|---|
| UPI PSP webhook | 🟡 Mocked, not a real PSP | `backend/src/routes/webhooks.ts` has full HMAC verification + idempotency + on-chain `attestDonation` call, but there's no Razorpay/Cashfree SDK — `backend/scripts/simulateUpiWebhook.ts` generates fixture events, `backend/README.md` calls it out explicitly |
| Bank reconciliation job | ✅ Done (CSV import, amount-based debit matching) | `backend/src/jobs/reconciliationJob.ts` + `backend/src/db/repositories/reconciliationRepo.ts` — manager-signed `POST /api/campaigns/:id/reconciliation/import` matches statement rows against donations/spends both directions (LLD §7.2), `npm run reconcile:nightly` re-runs matching for every active campaign. Credit rows match donations exactly by UTR hash; debit rows match spends by amount only, since `attestSpend` is still always called with `ethers.ZeroHash` for its UTR (see below) |

**Known gap this doesn't fix:** spends still carry no real bank settlement UTR — `attestSpend` is always
called with `ethers.ZeroHash` (`backend/src/routes/pendingSpends.ts`). Debit-side reconciliation is
therefore amount-matched, not UTR-matched like the credit side. Wiring a real UTR into the spend-approval
flow is its own follow-up.

### MVP 2 — trust score: partial, real for the wired campaign

🟡 **Partial, by deliberate scope decision.** The published formula (LLD §8) has 5 weighted terms; 3 have
real backing data today and are computed server-side (`backend/src/indexer/aggregate.ts`):
`evidencedSpendPct` (30/75 weight), `deliveryAttestedPct` (25/75 weight), and `reconciliationMatchPct`
(20/75 weight, now live off the bank reconciliation job above), reweighted to sum to 1 in the LLD's
original ratio. The other 2 (`promiseAlignmentScore`, `attestorDiversityScore`) need infrastructure that
doesn't exist yet — a stored promised-category-split and a real attestor roles table respectively — and
are reported as `pending` in the API response (`trustScoreBreakdown.pending`) rather than faked.

For campaigns with a real `backendId`, `frontend/lib/mergeCampaign.ts` now overlays the real
`trustScore` + `trustScoreBreakdown`, and the campaign page's trust-score ring shows an "i" affordance
that discloses the methodology and what's still pending (HLD §8's requirement that the formula be
published, not just the number). Campaigns without a `backendId` still show a static mock `trustScore`
with no methodology disclosure — `trustScoreBreakdown` is `undefined` in that case by design, so the UI
never implies a mock number is formula-computed.

### MVP 3 — CSR reporting: partial/mostly mock

🟡 **Partial.** `frontend/app/csr/page.tsx` now overlays real data (raised/spent/trust/evidence%/anomalies)
for every mock campaign row that has a `backendId`, via a new `GET /api/csr/portfolio`
(`backend/src/routes/csr.ts`) that aggregates across every real on-chain campaign in one call. **Scope
decision**: there is no company/donor-attribution data model anywhere in the system (donations are
anonymous UPI payments, not linked to a specific CSR company), so this is one shared portfolio across
every campaign, not a real per-company subset -- matches the dashboard's actual current design (a shared
view for any logged-in CSR user), not the LLD's literal `:companyId` framing. Building real per-company
attribution would need a new data model with no existing spec to build it from. The portfolio summary
tiles (total disbursed, campaigns supported, avg trust score, spend-with-evidence%, open anomalies) are
now computed from whatever's in the overlaid campaign list rather than hardcoded strings.
`frontend/app/csr/admin/page.tsx` stays pure mock -- it's a full CRUD console (campaign creation,
operator PIN generation, assignments) for actions with no real backend counterpart at all (campaigns are
created via the contract's `createCampaign` by an operator wallet, not an admin form; there's no
operator-PIN auth system, operators sign with wallets per `auth/operatorSignature.ts`). Wiring it "real"
would mean inventing those backend features from scratch, well beyond wiring existing data.
The LLD's export endpoint (`GET /api/csr/:companyId/report?format=pdf|xlsx`) still does not exist.

### MVP 4 — network intelligence: not started

❌ **Not started**, and correctly so — the LLD marks this design-level pending a real MVP3 dataset.
Zero references to collusion detection or vendor reputation graphs anywhere in the code.

## Frontend surfaces

| Page | Data |
|---|---|
| `/` (homepage) | Static/mock |
| `/campaigns` | Mix — real aggregate overlay where a `backendId` exists, mock otherwise |
| `/campaign/[slug]` | Mix — real aggregate/feed/AI report merged in; story, donors, trust score stay mock |
| `/campaign/[slug]/donate` | Same campaign data model as above |
| `/csr` | Mix — real overlay for every campaign with a `backendId` (shared portfolio, not per-company), rest mock |
| `/csr/admin` | Pure mock, no backend wiring |
| `/operator` | Mix — real wallet-signed spend recording (`recordSpend`) merged with local demo spends |
| `/arena` | Explicitly fictional demo, no backend |

`frontend/README.md` states outright that mock data in `lib/` is static/in-memory — matches the code, not
a misleading claim.

## Recently completed this session (not in the MVP roadmap)

- **Mobile wallet connect** — operator console now supports WalletConnect (`frontend/lib/wallet.ts`) as a
  fallback when no injected wallet exists (plain mobile Chrome), alongside the existing MetaMask
  extension / in-app-browser flow. Tapping Connect on mobile now deep-links to MetaMask for approval and
  returns to the calling browser tab, instead of getting stuck inside MetaMask's own browser.
- **Mobile-responsive fix** — added the missing viewport meta tag (`frontend/app/layout.tsx`), which was
  causing the entire site to render desktop-zoomed-out on phones; fixed iOS input auto-zoom and the
  operator category picker's mobile layout.
- **Visual/interaction modernization** — site-wide pass (`frontend/app/globals.css` + every page) adding
  hover-lift cards, animated buttons, staggered entrance animations, animated progress bars/trust-score
  ring, toast/banner transitions — CSS-only, no new dependencies, `prefers-reduced-motion` respected.

## What's next (suggested priority order)

1. ~~**MVP 2 — Trust score formula.**~~ ✅ Done (partial, see above) — `evidencedSpendPct` +
   `deliveryAttestedPct` + `reconciliationMatchPct` now compute a real, reweighted trust score with the
   methodology published in-product; the other 2 terms are explicitly `pending`.
2. ~~**MVP 1+ — Bank reconciliation job.**~~ ✅ Done (see above) — CSV import + amount-based debit
   matching; a real settlement-UTR-on-spend flow would sharpen the debit side but isn't blocking.
3. ~~**MVP 3 — Real CSR portfolio data.**~~ ✅ Done (see above) — `GET /api/csr/portfolio` covers every
   real on-chain campaign now, not just the one previously wired. Still open: the `GET
   /api/csr/:companyId/report` PDF/XLSX export the LLD specifies (§9) — doesn't exist yet.
4. ~~**Evidence storage upgrade.**~~ ✅ Done (see above) — real IPFS via Pinata available behind
   `EVIDENCE_STORAGE_BACKEND=ipfs`, not yet verified against a live account, and no redundant second
   provider yet.
5. **MVP 1 — Real UPI PSP integration.** Swap the mocked webhook for a real Razorpay/Cashfree
   integration — bigger lift (compliance, live money), reasonable to defer until the proof-side (3–4
   above) is solid.
6. **MVP 4 — Network intelligence.** Correctly last: the LLD itself says not to build this until there's
   a real MVP3 dataset to validate collusion thresholds against.
