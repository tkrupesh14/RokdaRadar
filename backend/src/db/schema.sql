-- Exact LLD Section 3.2 schema, plus two additions flagged in the plan:
--   processed_events: true (tx_hash, log_index) idempotency key for every handler
--   indexer_state: last-processed block bookkeeping for backfill

CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY,
    operator TEXT NOT NULL,
    disaster_tag TEXT NOT NULL,
    darpan_id TEXT,
    reg_80g TEXT,
    promise_hash TEXT NOT NULL,
    raised_paise INTEGER NOT NULL DEFAULT 0,
    spent_paise INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    creation_tx_hash TEXT
);

CREATE TABLE IF NOT EXISTS donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
    utr_hash TEXT NOT NULL,
    donor_ref TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    ts INTEGER NOT NULL,
    tx_hash TEXT NOT NULL,
    UNIQUE(utr_hash)
);

CREATE TABLE IF NOT EXISTS spends (
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

CREATE TABLE IF NOT EXISTS delivery_attestations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spend_ref TEXT NOT NULL REFERENCES spends(spend_ref),
    attestor TEXT NOT NULL,
    ts INTEGER NOT NULL,
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
