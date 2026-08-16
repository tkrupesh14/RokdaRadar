# ReliefTrace — High-Level Architecture Document (HLD)
**Scope:** Backend systems only (contracts, indexing, AI, APIs, integrations)
**Version:** 1.0 | 13 August 2026
**Companion doc:** ReliefTrace — Low-Level Design (LLD), same date

---

## 1. Purpose and Scope

This document describes the backend architecture for ReliefTrace at system level — what services exist, how they communicate, what data flows between them, and why the boundaries are drawn where they are. It covers MVP 0 (hackathon) through MVP 4 (network effects), marking which components exist at each stage.

The frontend (Trust Mode + Arena Mode UI) is out of scope here — see the separate UI Design Documents. This doc is the backend's contract with that frontend and with the outside world.

---

## 2. Architectural Principles

These five rules from the prototype spec drive every decision in this document:

1. **The chain never custodies value.** No `payable`, no transfer, no token. Contracts store attestations only.
2. **No personal data ever reaches the chain or the AI.** Salted hashes, vendor-level and aggregate data only.
3. **The AI computes nothing.** All numbers are produced deterministically before the AI ever sees them.
4. **No spend record without evidence.** Enforced at the contract level, not by policy.
5. **Every AI claim is traceable to a transaction.** The indexer's job is to make that traceability cheap to compute.

A sixth principle specific to this document: **money and proof are different systems, connected by one narrow interface.** The Payment Domain (UPI/banking) and the Attestation Domain (Monad) never share a database, a service, or a trust boundary. The only thing that crosses between them is a payment reference (UTR) and its hash.

---

## 3. System Context Diagram

```
                              ┌─────────────────────────┐
                              │      Donors / Public     │
                              │  (browser, mobile web)   │
                              └────────────┬─────────────┘
                                           │ HTTPS
                              ┌────────────▼─────────────┐
                              │      Web / API Gateway    │
                              │   (Next.js API routes /   │
                              │      BFF layer)           │
                              └──┬────────┬────────┬──────┘
                 ┌───────────────┘        │        └────────────────┐
                 │                        │                         │
      ┌──────────▼─────────┐   ┌──────────▼──────────┐   ┌──────────▼──────────┐
      │   Payment Domain    │   │  Attestation Domain  │   │  Intelligence Domain │
      │  (UPI PSP webhook,  │   │  (Monad contracts,   │   │  (AI report service, │
      │  bank reconciler)   │   │   indexer, evidence) │   │   anomaly reasoning) │
      └──────────┬──────────┘   └──────────┬──────────┘   └──────────┬──────────┘
                 │                        │                         │
                 │ UTR + amount           │ events                  │ aggregate JSON
                 └───────────►  Attestation Domain  ◄────────────────┘
                                (writes proof, indexer reads it back)

      ┌─────────────────────┐   ┌───────────────────────┐   ┌──────────────────────┐
      │  Identity & Registry │   │   Evidence Storage     │   │   Reporting & Export  │
      │  (Darpan/80G lookup) │   │   (IPFS / S3-compat)   │   │   (CSR dashboards,    │
      │                      │   │                        │   │    PDF/XLSX export)   │
      └─────────────────────┘   └───────────────────────┘   └──────────────────────┘
```

---

## 4. Domains

### 4.1 Payment Domain
**Responsibility:** Move real rupees. Never touches Monad directly; only ever produces a payment event with a UTR.

**Components:**
- UPI PSP integration (Razorpay/Cashfree in MVP 1; mocked webhook in MVP 0)
- Webhook receiver with idempotency handling
- Bank statement reconciliation job (MVP 1+) — catches attestations that were never backed by a real bank transaction, and real transactions that were never attested

**MVP presence:** MVP 0 (mocked), MVP 1 (real)

### 4.2 Attestation Domain
**Responsibility:** The system of record. Everything that is true about a campaign's proof trail lives here, ultimately anchored on Monad.

**Components:**
- Smart contracts (campaign registry, donation/spend/delivery attestation)
- Event indexer (listens to chain events, builds queryable aggregates)
- Evidence store (content-addressed; IPFS in production, local hash store in MVP 0)
- Attestor registry (MVP 2+ — who is allowed to confirm delivery)

**MVP presence:** MVP 0 onward, growing in capability at each stage

### 4.3 Intelligence Domain
**Responsibility:** Turn deterministic aggregates into human-readable, multilingual, honest narrative. Never a source of truth for any number.

**Components:**
- Report generation service (grounded prompting, structured JSON output)
- Anomaly detection (deterministic rules in MVP 0; semantic drift detection from MVP 1)
- Translation layer (direct model output in MVP 0; Bhashini integration in MVP 2)
- Natural-language query endpoint (MVP 1+)

**MVP presence:** MVP 0 onward

### 4.4 Identity & Registry Domain
**Responsibility:** Bind an on-chain campaign to a real, verifiable Indian legal identity. This is the anti-fake-NGO layer.

**Components:**
- NGO Darpan lookup integration
- 80G/12A/FCRA registration verification
- Campaign onboarding workflow with identity gate

**MVP presence:** stubbed field in MVP 0, live integration in MVP 1

### 4.5 Reporting & Export Domain
**Responsibility:** Serve the compliance buyer. Produces artifacts that leave the system (PDF, XLSX) for board reports and statutory filings.

**Components:**
- CSR portfolio dashboard API
- Board-report generator (hash-anchored appendix)
- Auditor read-only access layer

**MVP presence:** MVP 3

### 4.6 Network Intelligence Domain (MVP 4)
**Responsibility:** Cross-campaign analysis that no single campaign's data can support alone.

**Components:**
- Vendor reputation graph
- Collusion clustering engine
- Duplicate-assistance detector (hash-matched aggregate overlap, no PII)
- Public open-data API

**MVP presence:** MVP 4 only

---

## 5. Data Flow — the Two Journeys

### 5.1 Donation Journey
```
Donor pays via UPI
   → PSP webhook fires (amount, UTR, timestamp)
   → API Gateway validates + deduplicates (idempotency key = UTR hash)
   → Attestation Domain: oracle wallet calls attestDonation(campaignId, utrHash, donorRef, amountPaise)
   → Monad emits DonationAttested event
   → Indexer picks up event, updates campaign aggregate
   → Frontend polls/subscribes, live feed updates
```

### 5.2 Spend Journey
```
Operator submits spend form (vendor, amount, category, evidence file, memo)
   → Evidence uploaded to evidence store, CID returned
   → API Gateway calls attestSpend(campaignId, utrHash, vendorRef, amountPaise, category, evidenceCID, memo)
   → Contract REVERTS if evidenceCID is empty (hard rule, not app-level validation)
   → Monad emits SpendAttested event
   → Indexer updates aggregates, runs deterministic anomaly rules
   → On next report request: Intelligence Domain pulls aggregate JSON, generates narrative
   → Frontend renders report with per-claim hash links
```

### 5.3 Report-on-Demand Journey
```
Any visitor requests a report (or one auto-regenerates on new events)
   → API Gateway calls Indexer for current aggregate JSON (deterministic, cached)
   → API Gateway calls Intelligence Domain with aggregate JSON + grounded prompt
   → Model returns structured JSON (headline, breakdown, anomalies, translations)
   → API Gateway runs the guardrail check: every number in the model's output must
     appear in the input JSON, or the response is rejected and regenerated
   → Response cached and served
```

---

## 6. Trust Boundaries

| Boundary | What crosses it | What must never cross it |
|---|---|---|
| Donor browser ↔ API Gateway | amount, campaign ID, donor-chosen language | raw UPI VPA, phone number |
| API Gateway ↔ Payment Domain | UTR, amount, campaign ID | — |
| Payment Domain ↔ Attestation Domain | hashed UTR, amount in paise, salted donor reference | raw UTR, donor identity |
| Attestation Domain ↔ Intelligence Domain | deterministic aggregate JSON only | raw chain events, private keys |
| Intelligence Domain ↔ frontend | structured narrative JSON | model's raw chain-of-thought, unvalidated output |
| Operator ↔ Evidence Store | invoice files | beneficiary personal data (rejected at upload validation) |

This table is the single most important artifact in this document for a security reviewer — every row is a place where a bug would violate one of the five architectural principles in Section 2.

---

## 7. Deployment View (MVP 0 → MVP 1)

| Component | MVP 0 (hackathon) | MVP 1+ |
|---|---|---|
| Contracts | Monad testnet | Monad mainnet |
| Indexer | Node process + SQLite, local | Node service + Postgres, hosted |
| AI service | Direct Anthropic API calls | Same, with response caching layer |
| Evidence store | Local filesystem + SHA-256 | IPFS (Pinata/web3.storage) |
| Payment | Mocked webhook | Real PSP (Razorpay/Cashfree) integration |
| Identity registry | Stubbed field | Live Darpan/80G API integration |
| Hosting | Local / single Vercel deploy | Vercel + managed Postgres + dedicated indexer worker |

---

## 8. Non-Functional Requirements

| Requirement | Target | Notes |
|---|---|---|
| Attestation latency (donation) | < 2s from UPI confirmation to visible receipt | Relies on Monad's ~800ms finality |
| Report generation | < 5s for a campaign with up to 200 events | Aggregate computation must stay in-memory/cached |
| Indexer lag | < 3s behind chain head | Acceptable staleness for a transparency product |
| Uptime (MVP 1+) | 99.5% | Not safety-critical, but a public trust product going down during a live disaster is reputationally costly |
| Evidence availability | Content must resolve for at least 7 years | Matches typical NGO/audit document retention expectations |
| Language coverage | EN/HI/ML at MVP 0; +5 languages by MVP 2 | Bhashini integration point |

---

## 9. What Explicitly Does Not Exist in the Backend

Stated plainly so no reviewer assumes otherwise:
- No wallet infrastructure for donors (donors never hold or touch a private key)
- No token, no on-chain balance, no DeFi surface of any kind
- No beneficiary identity database anywhere in the system
- No AI system that has write access to the chain — the AI is read-only over aggregates, always

---

## 10. Open Architecture Questions (for post-hackathon design review)

1. Who operates the oracle wallet that calls `attestDonation`? A centralized backend signer is the MVP 0/1 answer; a decentralized oracle network is a later-stage question if trust-minimization becomes a stated requirement.
2. Should the indexer be replaced with a subgraph (The Graph-style) once query complexity grows past MVP 2? Revisit once cross-campaign queries (MVP 4) are in scope.
3. At what MVP stage does evidence storage need legal-hold / tamper-proof archival guarantees beyond IPFS pinning persistence?

---

*See the companion Low-Level Design document for contract interfaces, database schemas, API contracts, and prompt specifications.*
