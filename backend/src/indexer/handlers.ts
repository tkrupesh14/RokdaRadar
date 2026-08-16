import { getDb } from "../db/client.js";
import { markProcessedIfNew } from "../db/repositories/eventsRepo.js";
import { insertCampaign, incrementRaised, incrementSpent, deactivateCampaign } from "../db/repositories/campaignsRepo.js";
import { insertDonation } from "../db/repositories/donationsRepo.js";
import { insertSpend, markDeliveryAttested } from "../db/repositories/spendsRepo.js";
import { insertDeliveryAttestation } from "../db/repositories/deliveryRepo.js";
import { CATEGORIES } from "../config/constants.js";
import { runAnomalyRules } from "./anomalyRules.js";
import { invalidateReport } from "../ai/cache.js";

export type LogRef = { txHash: string; logIndex: number };

export type CampaignCreatedEvent = LogRef & {
  id: number;
  operator: string;
  disasterTag: string;
  darpanId: string;
  promiseHash: string;
  ts: number;
};

export type DonationAttestedEvent = LogRef & {
  id: number;
  utrHash: string;
  donorRef: string;
  amountPaise: number;
  ts: number;
};

export type SpendAttestedEvent = LogRef & {
  id: number;
  spendRef: string;
  utrHash: string;
  vendorRef: string;
  amountPaise: number;
  cat: number;
  evidenceCID: string;
  memo: string;
  ts: number;
};

export type DeliveryAttestedEvent = LogRef & {
  id: number;
  spendRef: string;
  attestor: string;
  ts: number;
};

// Every handler below is a single better-sqlite3 transaction: the
// processed_events idempotency check and the domain write commit together, so
// re-processing the same block on restart can never double-count (LLD 3.3).
function withIdempotency(txHash: string, logIndex: number, fn: () => void): void {
  const db = getDb();
  const run = db.transaction(() => {
    const isNew = markProcessedIfNew(txHash, logIndex);
    if (!isNew) return;
    fn();
  });
  run();
}

export function onCampaignCreated(evt: CampaignCreatedEvent): void {
  withIdempotency(evt.txHash, evt.logIndex, () => {
    insertCampaign({
      id: evt.id,
      operator: evt.operator,
      disaster_tag: evt.disasterTag,
      darpan_id: evt.darpanId,
      reg_80g: null,
      promise_hash: evt.promiseHash,
      created_at: evt.ts,
      creation_tx_hash: evt.txHash,
    });
  });
}

export function onDonationAttested(evt: DonationAttestedEvent): void {
  withIdempotency(evt.txHash, evt.logIndex, () => {
    insertDonation({
      campaign_id: evt.id,
      utr_hash: evt.utrHash,
      donor_ref: evt.donorRef,
      amount_paise: evt.amountPaise,
      ts: evt.ts,
      tx_hash: evt.txHash,
    });
    incrementRaised(evt.id, evt.amountPaise);
  });
}

export function onSpendAttested(evt: SpendAttestedEvent): void {
  withIdempotency(evt.txHash, evt.logIndex, () => {
    insertSpend({
      spend_ref: evt.spendRef,
      campaign_id: evt.id,
      utr_hash: evt.utrHash,
      vendor_ref: evt.vendorRef,
      amount_paise: evt.amountPaise,
      category: CATEGORIES[evt.cat],
      evidence_cid: evt.evidenceCID,
      memo: evt.memo,
      ts: evt.ts,
      tx_hash: evt.txHash,
    });
    incrementSpent(evt.id, evt.amountPaise);
  });
  // Anomaly recomputation is idempotent by nature (deterministic function of
  // current state), so it's safe to run outside the write transaction and
  // even if the event above was a replay no-op.
  runAnomalyRules(evt.id);
  // Report cache invalidation per LLD 5.4: any new SpendAttested invalidates
  // the cached report for that campaign.
  invalidateReport(evt.id);
}

export function onDeliveryAttested(evt: DeliveryAttestedEvent): void {
  withIdempotency(evt.txHash, evt.logIndex, () => {
    insertDeliveryAttestation({
      spend_ref: evt.spendRef,
      attestor: evt.attestor,
      ts: evt.ts,
      tx_hash: evt.txHash,
    });
    markDeliveryAttested(evt.spendRef);
  });
}

export function onCampaignClosed(campaignId: number): void {
  deactivateCampaign(campaignId);
}
