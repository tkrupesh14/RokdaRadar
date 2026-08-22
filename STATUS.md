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
| Evidence storage | 🟡 Partial (by design) | `backend/src/evidence/storage.ts` — local filesystem + SHA-256 hash standing in for a real CID; code comments label this the intentional MVP0 tier, not real IPFS |

### MVP 1+ — payment domain: mocked

| Component | Status | Evidence |
|---|---|---|
| UPI PSP webhook | ✅ Done (real Razorpay, mock still available) | `backend/src/payments/razorpay.ts` creates real Razorpay Orders (`POST /api/campaigns/:id/donate/order`); `backend/src/routes/webhooks.ts` now accepts Razorpay's real documented webhook shape (`X-Razorpay-Signature`, `payload.payment.entity`) alongside the original mock shape. Gated on `RAZORPAY_KEY_ID`/`SECRET` being set -- unset means the mocked `POST /api/campaigns/:id/donate` flow keeps working exactly as before. **Live-verified**: order creation was tested against a real Razorpay test-mode account (see PR). **Not live-verified**: actual webhook delivery from a real captured payment -- no public HTTPS URL exists in this dev environment for Razorpay to call, so that leg is covered by signature/payload-shape tests against Razorpay's documented format, not an end-to-end payment. Frontend Checkout UI (loading Razorpay's checkout.js, handling the async payment→webhook→attestation flow instead of the mock's synchronous response) is not wired up yet -- a real follow-up, not attempted speculatively without being able to verify the full loop. |
| Bank reconciliation job | ❌ Not started | No matches for "reconcil" anywhere in `backend/src` |

### MVP 2 — trust score: partial, real for the wired campaign

🟡 **Partial, by deliberate scope decision.** The published formula (LLD §8) has 5 weighted terms; 2 have
real backing data today and are computed server-side (`backend/src/indexer/aggregate.ts`):
`evidencedSpendPct` (30/55 weight) and `deliveryAttestedPct` (25/55 weight), reweighted to sum to 1 in
the LLD's original ratio. The other 3 (`reconciliationMatchPct`, `promiseAlignmentScore`,
`attestorDiversityScore`) need infrastructure that doesn't exist yet — the bank reconciliation job (next
item below), a stored promised-category-split, and a real attestor roles table respectively — and are
reported as `pending` in the API response (`trustScoreBreakdown.pending`) rather than faked.

For campaigns with a real `backendId`, `frontend/lib/mergeCampaign.ts` now overlays the real
`trustScore` + `trustScoreBreakdown`, and the campaign page's trust-score ring shows an "i" affordance
that discloses the methodology and what's still pending (HLD §8's requirement that the formula be
published, not just the number). Campaigns without a `backendId` still show a static mock `trustScore`
with no methodology disclosure — `trustScoreBreakdown` is `undefined` in that case by design, so the UI
never implies a mock number is formula-computed.

### MVP 3 — CSR reporting: partial/mostly mock

🟡 **Partial.** `frontend/app/csr/page.tsx` overlays real `getAggregate()` data only for the one campaign
with a real on-chain `backendId` (Wayanad); all portfolio-level CSR fields are static
(`frontend/lib/csrData.ts`). `frontend/app/csr/admin/page.tsx` is pure mock with no backend fetch at all.
The LLD's export endpoint (`GET /api/csr/:companyId/report?format=pdf|xlsx`) does not exist.

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
| `/csr` | Mix — one real campaign overlay, rest mock |
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
   `deliveryAttestedPct` now compute a real, reweighted trust score with the methodology published
   in-product; the other 3 terms are explicitly `pending`.
2. **MVP 1+ — Bank reconciliation job.** Now the top priority: needed for its own sake and to unblock
   the `reconciliationMatchPct` term so the trust score can grow toward the full 5-term formula. The UPI
   webhook side is already solid; this is the missing nightly job (LLD §7.2).
3. **MVP 3 — Real CSR data + export endpoint.** Extend backend aggregate/report endpoints to cover CSR
   portfolios beyond the single wired campaign, then build the `GET /api/csr/:companyId/report` PDF/XLSX
   export the LLD specifies (§9) — currently entirely missing.
4. **Evidence storage upgrade.** Move off local-filesystem+hash to real IPFS or S3-compatible storage —
   low urgency functionally, but a real gap versus the "immutable evidence" story.
5. ~~**MVP 1 — Real UPI PSP integration.**~~ ✅ Done, backend side (see above) — real Razorpay order
   creation and webhook handling, live-verified against a test-mode account. Still open: the frontend
   Checkout UI and the async payment→webhook→attestation UX it needs (the donate flow's "receipt" beat
   currently assumes a synchronous confirmation, which only the mock flow provides).
6. **MVP 4 — Network intelligence.** Correctly last: the LLD itself says not to build this until there's
   a real MVP3 dataset to validate collusion thresholds against.
