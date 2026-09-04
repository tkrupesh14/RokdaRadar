-- Exact LLD Section 3.2 schema, plus two additions flagged in the plan:
--   processed_events: true (tx_hash, log_index) idempotency key for every handler
--   indexer_state: last-processed block bookkeeping for backfill
-- Ported to Postgres (Supabase) from the original SQLite schema: AUTOINCREMENT
-- -> SERIAL, INTEGER -> BIGINT for amount/timestamp columns (SQLite INTEGER is
-- always 64-bit; Postgres INTEGER is 32-bit).

CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY,
    operator TEXT NOT NULL,
    disaster_tag TEXT NOT NULL,
    darpan_id TEXT,
    reg_80g TEXT,
    promise_hash TEXT NOT NULL,
    raised_paise BIGINT NOT NULL DEFAULT 0,
    spent_paise BIGINT NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL,
    creation_tx_hash TEXT
);

CREATE TABLE IF NOT EXISTS donations (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
    utr_hash TEXT NOT NULL,
    donor_ref TEXT NOT NULL,
    amount_paise BIGINT NOT NULL,
    ts BIGINT NOT NULL,
    tx_hash TEXT NOT NULL,
    UNIQUE(utr_hash)
);

CREATE TABLE IF NOT EXISTS spends (
    spend_ref TEXT PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
    utr_hash TEXT NOT NULL,
    vendor_ref TEXT NOT NULL,
    amount_paise BIGINT NOT NULL,
    category TEXT NOT NULL,
    evidence_cid TEXT NOT NULL,
    memo TEXT,
    ts BIGINT NOT NULL,
    tx_hash TEXT NOT NULL,
    delivery_attested INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS delivery_attestations (
    id SERIAL PRIMARY KEY,
    spend_ref TEXT NOT NULL REFERENCES spends(spend_ref),
    attestor TEXT NOT NULL,
    ts BIGINT NOT NULL,
    tx_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spends_campaign ON spends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_donations_campaign ON donations(campaign_id);

-- Idempotency backstop for every event handler (LLD Section 3.3: "use (tx_hash,
-- log_index) as the true dedupe key in production"). Applied to all four events,
-- not just donations, so the replay test in LLD Section 11 holds for every table.
CREATE TABLE IF NOT EXISTS processed_events (
    tx_hash TEXT NOT NULL,
    log_index INTEGER NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

-- Tracks the last block the indexer has fully processed, for backfill on restart.
CREATE TABLE IF NOT EXISTS indexer_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Spends an operator has submitted but that haven't been written on-chain
-- yet: POST /api/campaigns/:id/spend now stops here (after the Gemini
-- evidence-is-a-bill check passes) instead of calling attestSpend directly.
-- A campaign manager reviews the evidence out-of-band and calls
-- POST /api/pending-spends/:id/approve (which performs the actual
-- attestSpend call) or /reject (which just marks the row, no chain write).
CREATE TABLE IF NOT EXISTS pending_spends (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
    vendor_ref_hash TEXT NOT NULL,
    amount_paise BIGINT NOT NULL,
    category TEXT NOT NULL,
    memo TEXT,
    evidence_cid TEXT NOT NULL,
    evidence_mimetype TEXT NOT NULL,
    ai_reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    operator_address TEXT NOT NULL,
    submitted_at BIGINT NOT NULL,
    reviewed_at BIGINT,
    reviewer_address TEXT,
    review_note TEXT,
    tx_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_spends_campaign_status ON pending_spends(campaign_id, status);

-- Bank reconciliation (LLD Section 7.2, MVP1+): a campaign manager imports a
-- bank statement (CSV) and each line is matched against on-chain donations/
-- spends, in both directions. Credit lines match donations exactly by
-- utr_hash (donations always carry a real one). Debit lines are matched
-- against spends by amount_paise instead -- spends don't carry a real bank
-- UTR yet (attestSpend is always called with ethers.ZeroHash today; wiring a
-- real settlement UTR into the spend-approval flow is its own follow-up), so
-- exact amount matching is the best available signal for now. See
-- src/jobs/reconciliationJob.ts.
CREATE TABLE IF NOT EXISTS bank_statement_lines (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
    direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
    utr_hash TEXT,
    amount_paise BIGINT NOT NULL,
    txn_date TEXT NOT NULL,
    imported_at BIGINT NOT NULL,
    matched_donation_id INTEGER REFERENCES donations(id),
    matched_spend_ref TEXT REFERENCES spends(spend_ref)
);

CREATE INDEX IF NOT EXISTS idx_bank_lines_campaign ON bank_statement_lines(campaign_id);
