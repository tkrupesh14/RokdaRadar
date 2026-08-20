import type { PoolClient } from "pg";
import { withTransaction } from "../db/client.js";
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

// Every handler below runs inside a single Postgres transaction: the
// processed_events idempotency check and the domain write commit together, so
// re-processing the same block on restart can never double-count (LLD 3.3).
async function withIdempotency(
  txHash: string,
  logIndex: number,
  fn: (client: PoolClient) => Promise<void>
): Promise<void> {
  await withTransaction(async (client) => {
    const isNew = await markProcessedIfNew(txHash, logIndex, client);
    if (!isNew) return;
    await fn(client);
  });
}

export async function onCampaignCreated(evt: CampaignCreatedEvent): Promise<void> {
  await withIdempotency(evt.txHash, evt.logIndex, async (client) => {
    await insertCampaign(
      {
        id: evt.id,
        operator: evt.operator,
        disaster_tag: evt.disasterTag,
        darpan_id: evt.darpanId,
        reg_80g: null,
        promise_hash: evt.promiseHash,
        created_at: evt.ts,
        creation_tx_hash: evt.txHash,
      },
      client
    );
  });
}

export async function onDonationAttested(evt: DonationAttestedEvent): Promise<void> {
  await withIdempotency(evt.txHash, evt.logIndex, async (client) => {
    await insertDonation(
      {
        campaign_id: evt.id,
        utr_hash: evt.utrHash,
        donor_ref: evt.donorRef,
        amount_paise: evt.amountPaise,
        ts: evt.ts,
        tx_hash: evt.txHash,
      },
      client
    );
    await incrementRaised(evt.id, evt.amountPaise, client);
  });
}

export async function onSpendAttested(evt: SpendAttestedEvent): Promise<void> {
  await withIdempotency(evt.txHash, evt.logIndex, async (client) => {
    await insertSpend(
      {
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
      },
      client
    );
    await incrementSpent(evt.id, evt.amountPaise, client);
  });
  // Anomaly recomputation is idempotent by nature (deterministic function of
  // current state), so it's safe to run outside the write transaction and
  // even if the event above was a replay no-op.
  await runAnomalyRules(evt.id);
  // Report cache invalidation per LLD 5.4: any new SpendAttested invalidates
  // the cached report for that campaign.
  invalidateReport(evt.id);
}

export async function onDeliveryAttested(evt: DeliveryAttestedEvent): Promise<void> {
  await withIdempotency(evt.txHash, evt.logIndex, async (client) => {
    await insertDeliveryAttestation(
      {
        spend_ref: evt.spendRef,
        attestor: evt.attestor,
        ts: evt.ts,
        tx_hash: evt.txHash,
      },
      client
    );
    await markDeliveryAttested(evt.spendRef, client);
  });
}

export async function onCampaignClosed(campaignId: number): Promise<void> {
  await deactivateCampaign(campaignId);
}
