import type { CategoryName } from "../config/constants.js";

export type CampaignRow = {
  id: number;
  operator: string;
  disaster_tag: string;
  darpan_id: string | null;
  reg_80g: string | null;
  promise_hash: string;
  raised_paise: number;
  spent_paise: number;
  active: number;
  created_at: number;
  creation_tx_hash: string | null;
};

export type DonationRow = {
  id: number;
  campaign_id: number;
  utr_hash: string;
  donor_ref: string;
  amount_paise: number;
  ts: number;
  tx_hash: string;
};

export type SpendRow = {
  spend_ref: string;
  campaign_id: number;
  utr_hash: string;
  vendor_ref: string;
  amount_paise: number;
  category: CategoryName;
  evidence_cid: string;
  memo: string | null;
  ts: number;
  tx_hash: string;
  delivery_attested: number;
};

export type DeliveryAttestationRow = {
  id: number;
  spend_ref: string;
  attestor: string;
  ts: number;
  tx_hash: string;
};

export type VendorConcentrationEntry = {
  vendorRef: string;
  sharePct: number;
  spendCount: number;
};

export type AnomalyCandidate = {
  spendRef: string;
  reason: "vendor_concentration" | "admin_ratio" | "category_promise_mismatch";
  value: number | string;
};

export type CampaignAggregate = {
  campaignId: number;
  disasterTag: string;
  raisedPaise: number;
  spentPaise: number;
  unspentPaise: number;
  donationCount: number;
  spendCount: number;
  categorySplit: Record<CategoryName, number>;
  fieldVsAdminRatio: number;
  vendorConcentration: VendorConcentrationEntry[];
  medianDonationPaise: number;
  medianDisbursementLatencyHours: number;
  deliveryAttestedPct: number;
  anomalyCandidates: AnomalyCandidate[];
  txIndex: Record<string, string>;
};
