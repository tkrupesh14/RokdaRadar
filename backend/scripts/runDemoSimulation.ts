// Runs 3 real campaigns through the actual HTTP API (not DB seeding) against
// a live deployed Monad testnet contract: createCampaign -> attestDonation
// (via the mock UPI webhook) -> attestSpend (with real evidence files) ->
// attestDelivery, for each of the 3 orgs that already exist as static
// content in frontend/lib/campaigns.ts and frontend/lib/csrData.ts. This is
// meant to be kept as permanent demo data, not cleaned up afterward.
//
// Usage: OPERATOR_PRIVATE_KEY=0x... npx tsx scripts/runDemoSimulation.ts
import crypto from "node:crypto";
import { ethers } from "ethers";
import { buildCanonicalMessage } from "../src/auth/operatorSignature.js";

const BASE_URL = process.env.DEMO_BASE_URL || "http://localhost:4000";
const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY;
const WEBHOOK_HMAC_SECRET = process.env.WEBHOOK_HMAC_SECRET || "change-me-dev-secret";
// Comma-separated campaignIds that already exist on-chain from a prior
// partial run -- skip createCampaign for these and resume with donations/
// spends against the existing campaign instead of creating a duplicate.
const SKIP_CREATE_IDS = new Set(
  (process.env.SKIP_CREATE_CAMPAIGN_IDS || "")
    .split(",")
    .filter(Boolean)
    .map(Number)
);

if (!OPERATOR_PRIVATE_KEY) {
  console.error("OPERATOR_PRIVATE_KEY is required");
  process.exit(1);
}

const wallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY);

type SpendPlan = { vendorRef: string; amountPaise: number; category: string; memo: string };
type OrgPlan = {
  disasterTag: string;
  darpanId: string;
  reg80G: string;
  promiseText: string;
  donations: number[]; // amountPaise
  spends: SpendPlan[];
  deliverIndexes: number[]; // which spends (by index) get a delivery attestation
};

// Matches frontend/lib/campaigns.ts + csrData.ts org content exactly, so the
// backendId overlay (0, 1, 2 respectively) shows real numbers consistent
// with the existing narrative copy.
const ORGS: OrgPlan[] = [
  {
    // Wayanad Landslide Relief Fund -- Sahayog Trust
    disasterTag: "KL-WAYANAD-2026-07",
    darpanId: "DARPAN-WAY-2026-001",
    reg80G: "80G-WAY-2026-001",
    promiseText:
      "Emergency relief for landslide-affected families across three panchayats in Wayanad district: food, water, medical supplies and temporary shelter.",
    donations: [50000, 20000, 75000, 10000, 100000, 25000],
    spends: [
      { vendorRef: "local-bhai-logistics", amountPaise: 18400, category: "FOOD", memo: "Rice and lentils for relief camp" },
      { vendorRef: "kerala-tarp-co", amountPaise: 26000, category: "SHELTER", memo: "Tarpaulin sheets for temporary shelter" },
      { vendorRef: "wayanad-medical-store", amountPaise: 9800, category: "MEDICAL", memo: "ORS and antibiotics" },
      { vendorRef: "blue-spring-traders", amountPaise: 14000, category: "WATER", memo: "Drinking water cans" },
      { vendorRef: "local-bhai-logistics", amountPaise: 11200, category: "LOGISTICS", memo: "Transport for relief supplies" },
      { vendorRef: "admin-office-wayanad", amountPaise: 3100, category: "ADMIN", memo: "Printing and camp registration" },
    ],
    deliverIndexes: [0, 1, 3],
  },
  {
    // Assam Flood Relief 2026 -- Purbanchal Aid
    disasterTag: "AS-FLOOD-2026-08",
    darpanId: "DARPAN-ASM-2026-002",
    reg80G: "80G-ASM-2026-002",
    promiseText:
      "Emergency food, clean drinking water and temporary shelter for villages displaced by Brahmaputra flooding across Kamrup and Barpeta districts, Assam.",
    donations: [30000, 45000, 20000, 60000],
    spends: [
      { vendorRef: "brahmaputra-traders", amountPaise: 22000, category: "FOOD", memo: "Rice and pulses" },
      { vendorRef: "guwahati-med-supply", amountPaise: 9600, category: "WATER", memo: "Water purification tablets" },
      { vendorRef: "kamrup-traders", amountPaise: 15400, category: "SHELTER", memo: "Tarpaulin and rope" },
      { vendorRef: "boat-transport-co", amountPaise: 6200, category: "LOGISTICS", memo: "Boat transport for relief teams" },
    ],
    deliverIndexes: [0, 2],
  },
  {
    // Odisha Cyclone Rebuild Fund -- Tarang Foundation
    // Deliberately includes a memo containing an out-of-scope term
    // ("repair") on a SHELTER spend, matching the mock's anomaly:true flag --
    // this genuinely triggers the deterministic category_promise_mismatch
    // rule (LLD 3.5) rather than faking the anomaly flag.
    disasterTag: "OD-CYCLONE-2026-08",
    darpanId: "DARPAN-ODI-2026-003",
    reg80G: "80G-ODI-2026-003",
    promiseText:
      "Rebuilding damaged housing and restoring basic services in cyclone-hit coastal panchayats of Puri district, Odisha.",
    donations: [80000, 30000, 50000, 40000, 20000],
    spends: [
      { vendorRef: "puri-building-materials", amountPaise: 48000, category: "SHELTER", memo: "Roofing sheets" },
      { vendorRef: "coastal-power-services", amountPaise: 22000, category: "SHELTER", memo: "Generator fuel and repair" },
      { vendorRef: "coastal-supply-co", amountPaise: 17000, category: "FOOD", memo: "Emergency food kits" },
    ],
    deliverIndexes: [0],
  },
];

function signedAuth(route: string, campaignId: number | null) {
  const nonce = ethers.hexlify(ethers.randomBytes(16));
  const timestamp = Date.now();
  const message = buildCanonicalMessage(route, campaignId, nonce, timestamp);
  return { nonce, timestamp, message };
}

async function signMessage(message: string) {
  return wallet.signMessage(message);
}

async function createCampaign(org: OrgPlan): Promise<{ txHash: string }> {
  const { nonce, timestamp, message } = signedAuth("POST /api/campaigns", null);
  const signature = await signMessage(message);

  const res = await fetch(`${BASE_URL}/api/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      oracleAddress: wallet.address,
      disasterTag: org.disasterTag,
      darpanId: org.darpanId,
      reg80G: org.reg80G,
      promiseText: org.promiseText,
      auth: { address: wallet.address, nonce, timestamp, signature },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`createCampaign failed: ${res.status} ${JSON.stringify(body)}`);
  console.log(`  createCampaign -> ${body.txHash}`);
  return body;
}

async function simulateDonation(campaignId: number, amountPaise: number): Promise<void> {
  const payload = {
    event: "payment.captured",
    payload: {
      payment: {
        id: `pay_${crypto.randomBytes(8).toString("hex")}`,
        amount: amountPaise,
        utr: crypto.randomInt(100000000000, 999999999999).toString(),
        vpa: "donor@upi",
        notes: { campaignId: String(campaignId) },
      },
    },
  };
  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", WEBHOOK_HMAC_SECRET).update(rawBody).digest("hex");

  const res = await fetch(`${BASE_URL}/api/webhooks/upi`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Signature": signature },
    body: rawBody,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`donation failed: ${res.status} ${JSON.stringify(body)}`);
  console.log(`  attestDonation(${amountPaise}) -> ${body.txHash ?? body.status}`);
}

function fakeEvidencePdf(text: string): Buffer {
  return Buffer.from(`%PDF-1.4\n1 0 obj\n<< >>\nstream\n${text}\nendstream\nendobj\n%%EOF`, "latin1");
}

async function attestSpend(campaignId: number, spend: SpendPlan): Promise<string | undefined> {
  const route = "POST /api/campaigns/:id/spend";
  const { nonce, timestamp, message } = signedAuth(route, campaignId);
  const signature = await signMessage(message);

  const form = new FormData();
  form.set("vendorRef", spend.vendorRef);
  form.set("amountPaise", String(spend.amountPaise));
  form.set("category", spend.category);
  form.set("memo", spend.memo);
  form.set("authAddress", wallet.address);
  form.set("authNonce", nonce);
  form.set("authTimestamp", String(timestamp));
  form.set("authSignature", signature);
  const evidence = fakeEvidencePdf(`Invoice: ${spend.memo} -- ${spend.vendorRef} -- Rs ${spend.amountPaise / 100}`);
  form.set("evidenceFile", new Blob([evidence], { type: "application/pdf" }), "invoice.pdf");

  const res = await fetch(`${BASE_URL}/api/campaigns/${campaignId}/spend`, { method: "POST", body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(`attestSpend failed: ${res.status} ${JSON.stringify(body)}`);
  console.log(`  attestSpend(${spend.category}, ${spend.amountPaise}) -> ${body.txHash} spendRef=${body.spendRef}`);
  return body.spendRef;
}

async function attestDelivery(campaignId: number, spendRef: string): Promise<void> {
  const route = "POST /api/campaigns/:id/spend/:spendRef/deliver";
  const { nonce, timestamp, message } = signedAuth(route, campaignId);
  const signature = await signMessage(message);

  const res = await fetch(`${BASE_URL}/api/campaigns/${campaignId}/spend/${spendRef}/deliver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authAddress: wallet.address, authNonce: nonce, authTimestamp: timestamp, authSignature: signature }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`attestDelivery failed: ${res.status} ${JSON.stringify(body)}`);
  console.log(`  attestDelivery(${spendRef}) -> ${body.txHash}`);
}

async function waitForCampaignIndexed(campaignId: number, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE_URL}/api/campaigns/${campaignId}`);
    if (res.ok) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`campaign ${campaignId} did not appear in the indexer within ${timeoutMs}ms`);
}

async function main() {
  console.log(`Operator wallet: ${wallet.address}`);
  console.log(`Backend: ${BASE_URL}\n`);

  for (let campaignId = 0; campaignId < ORGS.length; campaignId++) {
    const org = ORGS[campaignId];
    console.log(`=== Campaign ${campaignId}: ${org.disasterTag} ===`);

    if (SKIP_CREATE_IDS.has(campaignId)) {
      console.log(`  skipping createCampaign (already exists on-chain), resuming with donations/spends`);
    } else {
      await createCampaign(org);
      console.log(`  waiting for indexer to pick up campaign ${campaignId}...`);
      await waitForCampaignIndexed(campaignId);
    }

    for (const amount of org.donations) {
      await simulateDonation(campaignId, amount);
    }

    const spendRefs: (string | undefined)[] = [];
    for (const spend of org.spends) {
      const ref = await attestSpend(campaignId, spend);
      spendRefs.push(ref);
    }

    for (const idx of org.deliverIndexes) {
      const ref = spendRefs[idx];
      if (ref) await attestDelivery(campaignId, ref);
    }

    console.log(`=== Campaign ${campaignId} done ===\n`);
  }

  console.log("All 3 campaigns simulated. Data is left in place (not cleaned up).");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
