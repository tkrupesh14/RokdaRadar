# ReliefTrace — Low-Level Design Document (LLD)
**Scope:** Backend implementation detail — contracts, schemas, APIs, service logic
**Version:** 1.0 | 13 August 2026
**Companion doc:** ReliefTrace — High-Level Architecture (HLD), same date

---

## 1. Purpose

This document specifies backend components at implementation level: exact contract interfaces, database schemas, API request/response contracts, the AI prompt/output contract, and the deterministic algorithms that must produce identical results regardless of who implements them. Where the HLD says *what talks to what*, this doc says *what exactly gets sent*.

Organized by MVP stage, matching the prototype spec. **MVP 0 is specified to build-ready detail; later MVPs are specified to design-ready detail** (enough to scope and estimate, not necessarily enough to code without further breakdown).

---

## 2. MVP 0 — Smart Contract Layer

### 2.1 Contract: `ReliefTraceIN.sol`

**Enums**
```solidity
enum Category { FOOD, WATER, MEDICAL, SHELTER, LOGISTICS, ADMIN }
```

**Structs**
```solidity
struct Campaign {
    address operator;      // NGO signing wallet
    address oracle;         // backend key permitted to attest donations
    string  disasterTag;    // e.g. "KL-WAYANAD-2026-07"
    string  darpanId;       // NGO Darpan registration number
    string  reg80G;         // 80G registration number
    bytes32 promiseHash;    // keccak256 of the public appeal text
    uint256 raisedPaise;
    uint256 spentPaise;
    bool    active;
}
```

**Storage**
```solidity
mapping(uint256 => Campaign) public campaigns;
uint256 public campaignCount;
```

**Events** (the indexer's entire data source — field order and types are a contract, don't change without versioning)
```solidity
event CampaignCreated(
    uint256 indexed id, address operator, string disasterTag,
    string darpanId, bytes32 promiseHash, uint256 ts
);
event DonationAttested(
    uint256 indexed id, bytes32 utrHash, bytes32 donorRef,
    uint256 amountPaise, uint256 ts
);
event SpendAttested(
    uint256 indexed id, bytes32 indexed spendRef, bytes32 utrHash,
    bytes32 vendorRef, uint256 amountPaise, Category cat,
    string evidenceCID, string memo, uint256 ts
);
event DeliveryAttested(
    uint256 indexed id, bytes32 indexed spendRef, address attestor, uint256 ts
);
```
`spendRef` is computed as `keccak256(abi.encodePacked(id, vendorRef, amountPaise, ts))` — a stable reference other events and the indexer key off.

**Function signatures**
```solidity
function createCampaign(
    address oracle, string calldata disasterTag,
    string calldata darpanId, string calldata reg80G,
    bytes32 promiseHash
) external returns (uint256 id);

function attestDonation(
    uint256 id, bytes32 utrHash, bytes32 donorRef, uint256 amountPaise
) external onlyOracle(id);

function attestSpend(
    uint256 id, bytes32 utrHash, bytes32 vendorRef, uint256 amountPaise,
    Category cat, string calldata evidenceCID, string calldata memo
) external onlyOperator(id) returns (bytes32 spendRef);

function attestDelivery(uint256 id, bytes32 spendRef) external;

function closeCampaign(uint256 id) external onlyOperator(id);
```

**Modifiers and guards**
```solidity
modifier onlyOperator(uint256 id) {
    require(msg.sender == campaigns[id].operator, "not operator");
    _;
}
modifier onlyOracle(uint256 id) {
    require(msg.sender == campaigns[id].oracle, "not oracle");
    _;
}
```

**Required reverts (test these explicitly)**
| Condition | Revert message |
|---|---|
| `attestSpend` called with empty `evidenceCID` | `"evidence required"` |
| any attest call on inactive campaign | `"inactive"` |
| non-operator calls `attestSpend` / `closeCampaign` | `"not operator"` |
| non-oracle calls `attestDonation` | `"not oracle"` |

**What is deliberately absent:** `payable` modifier anywhere, `receive()`, `fallback()`, any `transfer`/`send`/`call{value:}`, any ERC-20 reference. A code reviewer should be able to grep for `payable` and `value:` and find zero matches — that's the automated check for architectural principle #1.

### 2.2 Deployment Parameters
- Network: Monad testnet (MVP 0) → Monad mainnet (MVP 1)
- Compiler: Solidity 0.8.24, optimizer enabled, 200 runs
- Constructor: none required (stateless deploy, campaigns created post-deploy)

---

## 3. MVP 0 — Indexer

### 3.1 Responsibility
Subscribe to the four contract events, write normalized rows, expose one deterministic aggregate function. This service is the only thing in the system permitted to compute numbers that the AI will later phrase.

### 3.2 Database Schema (SQLite, MVP 0)

```sql
CREATE TABLE campaigns (
    id INTEGER PRIMARY KEY,
    operator TEXT NOT NULL,
    disaster_tag TEXT NOT NULL,
    darpan_id TEXT,
    reg_80g TEXT,
    promise_hash TEXT NOT NULL,
    raised_paise INTEGER NOT NULL DEFAULT 0,
    spent_paise INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
);

CREATE TABLE donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
    utr_hash TEXT NOT NULL,
    donor_ref TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    ts INTEGER NOT NULL,
    tx_hash TEXT NOT NULL,
    UNIQUE(utr_hash)                 -- idempotency at the indexer level too
);

CREATE TABLE spends (
    spend_ref TEXT PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
    utr_hash TEXT NOT NULL,
    vendor_ref TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    category TEXT NOT NULL,
    evidence_cid TEXT NOT NULL,
    memo TEXT,
    ts INTEGER NOT NULL,
    tx_hash TEXT NOT NULL,
    delivery_attested INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE delivery_attestations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spend_ref TEXT NOT NULL REFERENCES spends(spend_ref),
    attestor TEXT NOT NULL,
    ts INTEGER NOT NULL,
    tx_hash TEXT NOT NULL
);

CREATE INDEX idx_spends_campaign ON spends(campaign_id);
CREATE INDEX idx_donations_campaign ON donations(campaign_id);
```

### 3.3 Event Handlers (pseudocode)
```
on CampaignCreated(id, operator, disasterTag, darpanId, promiseHash, ts):
    INSERT INTO campaigns (...)

on DonationAttested(id, utrHash, donorRef, amountPaise, ts):
    INSERT INTO donations (...) ON CONFLICT(utr_hash) DO NOTHING
    UPDATE campaigns SET raised_paise = raised_paise + amountPaise WHERE id = ?

on SpendAttested(id, spendRef, utrHash, vendorRef, amountPaise, cat, evidenceCID, memo, ts):
    INSERT INTO spends (...)
    UPDATE campaigns SET spent_paise = spent_paise + amountPaise WHERE id = ?
    -> trigger runAnomalyRules(id)   // section 3.5

on DeliveryAttested(id, spendRef, attestor, ts):
    INSERT INTO delivery_attestations (...)
    UPDATE spends SET delivery_attested = 1 WHERE spend_ref = ?
```
All handlers must be idempotent — re-processing the same block on indexer restart must not double-count. Use `(tx_hash, log_index)` as the true dedupe key in production; the `UNIQUE(utr_hash)` constraint is a secondary safety net for MVP 0.

### 3.4 Aggregate Computation — `GET /api/campaign/:id/aggregate`
Deterministic function, no AI involvement. Pure SQL + arithmetic.

```
raisedPaise, spentPaise, unspentPaise = spentPaise - raisedPaise... 
    -> unspentPaise = raised_paise - spent_paise
donationCount = COUNT(donations WHERE campaign_id = id)
spendCount = COUNT(spends WHERE campaign_id = id)
categorySplit = SUM(amount_paise) GROUP BY category WHERE campaign_id = id
fieldVsAdminRatio = (spentPaise - categorySplit.ADMIN) / spentPaise
vendorConcentration = SUM(amount_paise) GROUP BY vendor_ref
    ORDER BY sum DESC, sharePct = sum / spentPaise * 100
medianDonationPaise = MEDIAN(donations.amount_paise)
medianDisbursementLatencyHours =
    MEDIAN(spend.ts - <matching donation window ts>)  // simplified in MVP0: 
    campaign-level, time from first donation to each spend, median across spends
deliveryAttestedPct = COUNT(spends WHERE delivery_attested=1) / spendCount * 100
```

Output JSON shape — this exact shape is the Intelligence Domain's only input (see Section 5):
```json
{
  "campaignId": 1,
  "disasterTag": "KL-WAYANAD-2026-07",
  "raisedPaise": 4820000,
  "spentPaise": 3760000,
  "unspentPaise": 1060000,
  "donationCount": 41,
  "spendCount": 15,
  "categorySplit": { "FOOD": 1420000, "WATER": 780000, "MEDICAL": 560000,
                      "SHELTER": 640000, "LOGISTICS": 240000, "ADMIN": 120000 },
  "fieldVsAdminRatio": 0.968,
  "vendorConcentration": [
    { "vendorRef": "0x9a3f...", "sharePct": 41.2, "spendCount": 4 }
  ],
  "medianDonationPaise": 50000,
  "medianDisbursementLatencyHours": 31,
  "deliveryAttestedPct": 60.0,
  "anomalyCandidates": [ { "spendRef": "0x77c1...", "reason": "vendor_concentration", "value": 41.2 } ],
  "txIndex": { "0x77c1...": "0xabc123..." }
}
```

### 3.5 Deterministic Anomaly Rules (MVP 0 — exactly three, no ML)
```
RULE vendor_concentration:
    for each vendor in vendorConcentration:
        if vendor.sharePct > 35: flag(spendRef, "vendor_concentration", vendor.sharePct)

RULE admin_ratio:
    adminPct = categorySplit.ADMIN / spentPaise * 100
    if adminPct > 15: flag(campaignId, "admin_ratio", adminPct)

RULE category_promise_mismatch (keyword pass, MVP 0 only):
    OUT_OF_SCOPE_TERMS = ["office", "repair", "renovation", "furniture", "vehicle purchase"]
    for each spend:
        if any(term in spend.memo.lower() for term in OUT_OF_SCOPE_TERMS)
           and spend.category in [SHELTER, ADMIN]:
            flag(spend.spendRef, "category_promise_mismatch", spend.memo)
```
MVP 1 replaces rule 3 with an embedding-similarity comparison between `promiseHash`'s source text and each memo; rules 1 and 2 remain deterministic forever — they should never become AI judgment calls.

---

## 4. MVP 0 — API Layer

All routes are Next.js API routes (or equivalent Express/Fastify service). REST, JSON in/out.

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `POST` | `/api/campaigns` | Create a campaign | operator wallet signature |
| `GET` | `/api/campaigns/:id` | Campaign metadata | public |
| `GET` | `/api/campaigns/:id/aggregate` | Deterministic aggregate (Section 3.4) | public |
| `GET` | `/api/campaigns/:id/feed` | Paginated transaction feed | public |
| `POST` | `/api/campaigns/:id/donate` | Initiate mock UPI payment | public |
| `POST` | `/api/webhooks/upi` | PSP webhook receiver | webhook signature (HMAC) |
| `POST` | `/api/campaigns/:id/spend` | Operator records a spend | operator wallet signature |
| `POST` | `/api/campaigns/:id/spend/:spendRef/deliver` | Delivery attestation | attestor allowlist |
| `GET` | `/api/campaigns/:id/report` | AI-generated report (cached) | public |
| `POST` | `/api/campaigns/:id/report/refresh` | Force report regeneration | rate-limited, public |

### 4.1 Example Contract — `POST /api/campaigns/:id/spend`

**Request**
```json
{
  "vendorRef": "raw-vendor-identifier-to-be-hashed-serverside",
  "amountPaise": 6400000,
  "category": "SHELTER",
  "memo": "Repair of block office roof and boundary wall",
  "evidenceFile": "<multipart file>"
}
```

**Server-side steps**
1. Validate operator signature / session
2. Upload `evidenceFile` to evidence store → get `evidenceCID`
3. Hash `vendorRef` server-side → `vendorRef` (bytes32) — raw value never stored or logged
4. Call `attestSpend(id, utrHash=0x0 (n/a for spend), vendorRefHash, amountPaise, category, evidenceCID, memo)`
5. Wait for transaction receipt
6. Return response

**Response (success, 201)**
```json
{
  "spendRef": "0x77c1...",
  "txHash": "0xabc123...",
  "explorerUrl": "https://explorer.monad.xyz/tx/0xabc123...",
  "status": "confirmed"
}
```

**Response (contract revert, 422)**
```json
{
  "error": "evidence required",
  "code": "CONTRACT_REVERT",
  "detail": "The contract rejected this transaction because no evidence was attached."
}
```

### 4.2 Example Contract — `GET /api/campaigns/:id/report`

**Response (200)**
```json
{
  "generatedAt": "2026-08-13T09:14:02Z",
  "headline": "This campaign has spent 96.8% of donations on direct relief categories.",
  "summary": "...",
  "breakdown": [
    { "category": "FOOD", "text": "...", "ref": "0x77c1..." }
  ],
  "anomalies": [
    {
      "spendRef": "0x2be4...",
      "severity": "concern",
      "finding": "This spend is categorized as SHELTER but its memo describes office repairs, which falls outside the campaign's stated relief purpose.",
      "reasoning": "..."
    }
  ],
  "promiseConsistency": { "verdict": "drifting", "text": "..." },
  "translations": {
    "hi": { "headline": "...", "summary": "..." },
    "ml": { "headline": "...", "summary": "..." }
  }
}
```

---

## 5. MVP 0 — Intelligence Domain (AI Service)

### 5.1 Service Contract
**Input:** the aggregate JSON from Section 3.4, exactly as produced by the indexer — no other data source permitted.
**Output:** JSON matching the schema in Section 4.2, validated against a JSON Schema before being cached or returned.

### 5.2 System Prompt (implementation-ready)
```
You are a financial transparency reporter for an Indian disaster relief campaign.

HARD RULES:
1. You may ONLY use numbers that appear in the JSON payload below. Never
   calculate, estimate, infer, or round a figure that is not literally present
   in the payload.
2. Every factual sentence in "summary" and "breakdown" must carry a "ref" field
   pointing to a spendRef or campaignId present in the payload's txIndex.
3. If the payload lacks data needed to support a claim, omit the claim entirely.
   Never fill a gap with a plausible-sounding number.
4. Write for a reader with no accounting background. Use lakh/crore convention
   for amounts above 1,00,000 paise-equivalent rupees where natural.
5. For each entry in anomalyCandidates, assign severity ("info", "query", or
   "concern") and explain your reasoning using only the memo, category, and
   amount fields provided. You may reason about plausibility; you may not
   invent facts not present in the payload.
6. Return valid JSON only. No markdown code fences. No text outside the JSON.

OUTPUT SCHEMA:
<insert JSON schema from 4.2>

PAYLOAD:
<insert aggregate JSON>
```

### 5.3 Guardrail Validation (runs after every model call, before caching)
```python
def validate_report(report: dict, payload: dict) -> bool:
    payload_numbers = extract_all_numbers(payload)          # every int/float in payload
    report_numbers = extract_all_numbers(report, exclude_keys={"ref", "spendRef"})
    for n in report_numbers:
        if n not in payload_numbers and not is_derived_percentage(n, payload_numbers):
            return False   # reject and regenerate, log the violation
    for claim in report["breakdown"] + report["anomalies"]:
        if "ref" not in claim or claim["ref"] not in payload["txIndex"]:
            return False
    return True
```
`is_derived_percentage` allows simple, auditable derived values (e.g., a percentage computed from two payload numbers) but the derivation itself should ideally happen in the indexer, not be trusted from the model — treat this as a temporary allowance to tighten in MVP 1, not a permanent escape hatch.

**On validation failure:** regenerate once with a stricter reminder appended to the prompt; on second failure, serve the last known-good cached report and log an alert. Never serve an unvalidated report.

### 5.4 Caching
Reports are cached per campaign, invalidated on any new `SpendAttested` event for that campaign, and rate-limited on manual refresh (max 1 per 30s per campaign) to control model API cost.

---

## 6. MVP 0 — Evidence Storage

**MVP 0:** local filesystem under `/evidence/{campaignId}/{spendRef}.{ext}`, SHA-256 hash computed on upload and stored as the "CID" for demo purposes — the mechanism (hash-then-reference) is identical to production, only the storage backend differs.

**MVP 1:** IPFS via Pinata or web3.storage. Upload flow: file → pin → CID returned → CID passed to `attestSpend`. Add a redundant pin (two providers) so evidence doesn't disappear if one pinning service has an outage.

**Validation on upload (both stages):** file type allowlist (image/jpeg, image/png, application/pdf), max 10MB, and a rejection rule if OCR/metadata scanning (MVP 1+) detects an Aadhaar-number-shaped or PAN-shaped string in the document — flag for manual redaction before pinning, per architectural principle #2.

---

## 7. MVP 1+ — Payment Domain Detail

### 7.1 UPI Webhook Contract (Razorpay-style, adjust per chosen PSP)
```json
POST /api/webhooks/upi
Headers: X-Webhook-Signature: <HMAC-SHA256>

{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "id": "pay_XXXXXXXX",
      "amount": 50000,
      "utr": "308825001234",
      "vpa": "donor@upi",
      "notes": { "campaignId": "1" }
    }
  }
}
```

**Handler logic**
1. Verify HMAC signature against PSP secret — reject unsigned/invalid requests with 401
2. Check idempotency: has this `payment.id` been processed? If yes, return 200 without reprocessing
3. Hash the VPA server-side with a per-deployment salt → `donorRef` — raw VPA is never persisted
4. Call `attestDonation(campaignId, utrHash, donorRef, amountPaise)`
5. Store mapping `payment.id → tx_hash` for support/reconciliation purposes only (not exposed via any public API)

### 7.2 Bank Reconciliation Job (nightly, MVP 1+)
```
FOR each campaign's linked bank account statement (CSV import or bank API):
    FOR each credit transaction:
        IF no donation row exists with matching UTR:
            → flag as "unattested inbound payment" for operator review
    FOR each debit transaction:
        IF no spend row exists with matching UTR:
            → flag as "unattested outbound payment" — this is the critical
              fraud-catching check: it catches an operator who attests only
              the spends that look good and quietly omits the rest
```
This job's output feeds directly into the campaign's trust score (Section 8).

---

## 8. MVP 2 — Trust Score (published formula, deterministic)

```
trustScore =
      0.30 * (evidencedSpendPct)               // % of spend paise with evidenceCID
    + 0.25 * (deliveryAttestedPct)              // from Section 3.4
    + 0.20 * (reconciliationMatchPct)           // from Section 7.2, both directions
    + 0.15 * (promiseAlignmentScore)            // 1.0 aligned / 0.5 drifting / 0.0 mismatch
    + 0.10 * (attestorDiversityScore)           // distinct attestor roles / max roles

trustScore is 0-100, computed server-side, never by the AI.
```
This formula must be published in-product (linked from the Trust Score Gauge) — an opaque score defeats the product's purpose.

---

## 9. MVP 3 — CSR Reporting Detail

**Export endpoint:** `GET /api/csr/:companyId/report?format=pdf|xlsx&from=&to=`
Generates a document containing: portfolio summary, per-campaign spend tables matching standard CSR annual-report disclosure line items, and a verification appendix listing every included transaction's hash and Monad Explorer link — an auditor should be able to reproduce every figure in the document from the appendix alone, without trusting ReliefTrace's rendering.

---

## 10. MVP 4 — Network Intelligence Detail (design-level)

- **Vendor reputation graph:** nodes = `vendorRef` hashes, edges = campaigns they've served, weighted by consistency of unit pricing across campaigns for comparable categories. Stored in a graph-capable store (Neo4j or a Postgres+recursive-CTE approximation for smaller scale).
- **Collusion clustering:** flag `operator`/`vendorRef` pairs with disproportionately exclusive transaction history across multiple campaigns (a vendor who only ever appears under one operator, at volume, is a stronger signal than one serving many operators).
- **Duplicate-assistance detection:** salted-hash overlap of aggregate beneficiary-count claims across campaigns operating in the same disasterTag/geography window — no raw beneficiary identity ever compared, only counts and hashed household references voluntarily submitted by operators.

These remain design-level pending a real MVP 3 dataset to validate thresholds against — do not hardcode collusion thresholds without real distribution data first.

---

## 11. Testing Requirements by Layer

| Layer | Required tests |
|---|---|
| Contract | Unit tests for every revert condition (Section 2.2 table); fuzz test on `amountPaise` bounds; explicit test that no function is `payable` |
| Indexer | Replay test: process the same block twice, assert no double-counting; aggregate correctness test against a hand-computed fixture |
| AI service | Guardrail test (Section 5.3) run against at least 10 varied payloads before every deploy; adversarial test with a payload containing no anomalies (must not hallucinate one) |
| API | Idempotency test on webhook double-delivery; auth rejection tests for every protected route |
| Evidence | Upload rejection test for oversized/wrong-type files; redaction-flag test with a synthetic Aadhaar-shaped string |

---

*See the companion High-Level Architecture document for system context, trust boundaries, and deployment topology.*
