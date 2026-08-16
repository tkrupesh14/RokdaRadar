export type LedgerRow = {
  date: string;
  desc: string;
  category: string;
  amount: number;
  hash: string;
};

export type CampaignDetail = {
  slug: string;
  org: string;
  name: string;
  region: string;
  disasterTag: string;
  raised: number;
  spent: number;
  trustScore: number;
  categories: { name: string; pct: number; color: string }[];
  story: string[];
  ledger: LedgerRow[];
  updates: { date: string; text: string }[];
  donors: { name: string; amount: number }[];
  mapLabel: string;
  /**
   * Backend campaignId for this mock entry, once a real on-chain campaign
   * exists for it. When set, the page overlays real raised/spent/category/
   * ledger/report data from the backend on top of this static narrative
   * content (org/story/updates/mapLabel have no backend equivalent -- see
   * HLD principle #2, no personal/editorial data on chain -- so they always
   * come from here). Absent or unreachable backend falls back to the static
   * numbers below untouched.
   */
  backendId?: number;
};

export type RelatedCampaign = {
  slug: string;
  location: string;
  name: string;
  blurb: string;
  raised: number;
};

const CAT_COLORS = [
  "var(--color-accent-500)",
  "var(--color-accent-2-500)",
  "var(--color-accent-300)",
  "var(--color-accent-2-300)",
  "var(--color-accent-700)",
  "var(--color-neutral-400)",
];

export const CAMPAIGNS: Record<string, CampaignDetail> = {
  "wayanad-landslide-relief-fund": {
    slug: "wayanad-landslide-relief-fund",
    org: "Sahayog Trust",
    name: "Wayanad Landslide Relief Fund",
    region: "Kerala",
    disasterTag: "Landslide",
    raised: 482600,
    spent: 342000,
    trustScore: 92,
    categories: [
      { name: "Food", pct: 32 },
      { name: "Water", pct: 18 },
      { name: "Medical", pct: 22 },
      { name: "Shelter", pct: 16 },
      { name: "Logistics", pct: 8 },
      { name: "Admin", pct: 4 },
    ].map((c, i) => ({ ...c, color: CAT_COLORS[i] })),
    story: [
      "Following the landslides that displaced families across three panchayats in Wayanad district, Sahayog Trust opened this fund to cover emergency food, clean water, medical supplies and temporary shelter. Every spend is recorded with vendor evidence before it reaches the ledger.",
      "Donations move through UPI, same as any other payment. Only the record of where the money went is written to Monad — the fund never holds or moves cryptocurrency.",
    ],
    ledger: [
      { date: "Aug 14", desc: "Rice & lentils — Local Bhai Logistics", category: "Food", amount: 18400, hash: "0x7a3f...9e21" },
      { date: "Aug 12", desc: "Tarpaulin sheets — Kerala Tarp Co.", category: "Shelter", amount: 26000, hash: "0x2f8b...c110" },
      { date: "Aug 10", desc: "ORS & antibiotics — Wayanad Medical Store", category: "Medical", amount: 9800, hash: "0x66e0...ab77" },
      { date: "Aug 9", desc: "Drinking water cans — Blue Spring Traders", category: "Water", amount: 14000, hash: "0x3bd9...aa02" },
      { date: "Aug 8", desc: "Transport — Local Bhai Logistics", category: "Logistics", amount: 11200, hash: "0x0091...7be4" },
      { date: "Aug 6", desc: "Printing & camp registration — admin", category: "Admin", amount: 3100, hash: "0x51ac...7f02" },
    ],
    updates: [
      { date: "Aug 14, 2026", text: "Second batch of tarpaulin sheets delivered to the Meppadi relief camp, covering 40 more families." },
      { date: "Aug 10, 2026", text: "A temporary medical camp opened in coordination with the district health department." },
      { date: "Aug 6, 2026", text: "Fund opened. First UPI donations received within the hour." },
    ],
    donors: [
      { name: "Priya S.", amount: 2000 },
      { name: "Anonymous", amount: 500 },
      { name: "Rohit Menon", amount: 5000 },
      { name: "Anonymous", amount: 100 },
      { name: "Fatima K.", amount: 1000 },
    ],
    mapLabel: "map: Wayanad district, Kerala — affected panchayats",
    // The contract's campaignCount starts at 0, so the first campaign ever
    // created on-chain is id 0.
    backendId: 0,
  },
  "assam-flood-relief-2026": {
    slug: "assam-flood-relief-2026",
    org: "Purbanchal Aid",
    name: "Assam Flood Relief 2026",
    region: "Assam",
    disasterTag: "Flood",
    raised: 318000,
    spent: 210000,
    trustScore: 78,
    categories: [
      { name: "Food", pct: 38 },
      { name: "Water", pct: 24 },
      { name: "Medical", pct: 14 },
      { name: "Shelter", pct: 16 },
      { name: "Logistics", pct: 6 },
      { name: "Admin", pct: 2 },
    ].map((c, i) => ({ ...c, color: CAT_COLORS[i] })),
    story: [
      "Annual monsoon flooding along the Brahmaputra has displaced families across several districts in Assam. Purbanchal Aid opened this fund to cover emergency food, clean drinking water and temporary shelter for the worst-affected villages.",
      "Donations move through UPI, same as any other payment. Only the record of where the money went is written to Monad — the fund never holds or moves cryptocurrency.",
    ],
    ledger: [
      { date: "Aug 13", desc: "Rice & pulses — Brahmaputra Traders", category: "Food", amount: 22000, hash: "0x4c1a...7d02" },
      { date: "Aug 11", desc: "Water purification tablets — Guwahati Med Supply", category: "Water", amount: 9600, hash: "0x88bf...3e91" },
      { date: "Aug 9", desc: "Tarpaulin & rope — Kamrup Traders", category: "Shelter", amount: 15400, hash: "0x1a90...cc44" },
      { date: "Aug 7", desc: "Boat transport for relief teams", category: "Logistics", amount: 6200, hash: "0x5f6e...12ab" },
    ],
    updates: [
      { date: "Aug 13, 2026", text: "Second round of dry ration kits distributed across Kamrup and Barpeta districts." },
      { date: "Aug 7, 2026", text: "Fund opened as flood waters rose across four districts." },
    ],
    donors: [
      { name: "Anonymous", amount: 1000 },
      { name: "Nikhil D.", amount: 2500 },
      { name: "Anonymous", amount: 200 },
    ],
    mapLabel: "map: Kamrup & Barpeta districts, Assam — affected villages",
    backendId: 1,
  },
  "odisha-cyclone-rebuild-fund": {
    slug: "odisha-cyclone-rebuild-fund",
    org: "Tarang Foundation",
    name: "Odisha Cyclone Rebuild Fund",
    region: "Odisha",
    disasterTag: "Cyclone",
    raised: 512000,
    spent: 398000,
    trustScore: 65,
    categories: [
      { name: "Food", pct: 20 },
      { name: "Water", pct: 12 },
      { name: "Medical", pct: 10 },
      { name: "Shelter", pct: 44 },
      { name: "Logistics", pct: 10 },
      { name: "Admin", pct: 4 },
    ].map((c, i) => ({ ...c, color: CAT_COLORS[i] })),
    story: [
      "A coastal cyclone tore through fishing villages in Odisha, damaging homes and knocking out power for days. Tarang Foundation opened this fund to rebuild damaged housing and restore basic services in the hardest-hit coastal panchayats.",
      "Donations move through UPI, same as any other payment. Only the record of where the money went is written to Monad — the fund never holds or moves cryptocurrency.",
    ],
    ledger: [
      { date: "Aug 12", desc: "Roofing sheets — Puri Building Materials", category: "Shelter", amount: 48000, hash: "0x9b2c...aa10" },
      { date: "Aug 10", desc: "Generator fuel & repair", category: "Shelter", amount: 22000, hash: "0x3d71...560f" },
      { date: "Aug 8", desc: "Emergency food kits — Coastal Supply Co.", category: "Food", amount: 17000, hash: "0x0c4e...9911" },
    ],
    updates: [
      { date: "Aug 12, 2026", text: "Roofing materials delivered to 30 households in Puri district." },
      { date: "Aug 4, 2026", text: "Fund opened after cyclone made landfall on the Odisha coast." },
    ],
    donors: [
      { name: "Anonymous", amount: 5000 },
      { name: "Sunita R.", amount: 1500 },
    ],
    mapLabel: "map: Puri coastal panchayats, Odisha — affected villages",
    backendId: 2,
  },
  "himachal-landslide-emergency-fund": {
    slug: "himachal-landslide-emergency-fund",
    org: "Parvat Sewa Sangh",
    name: "Himachal Landslide Emergency Fund",
    region: "Himachal Pradesh",
    disasterTag: "Landslide",
    raised: 274000,
    spent: 190000,
    trustScore: 88,
    categories: [
      { name: "Food", pct: 18 },
      { name: "Water", pct: 10 },
      { name: "Medical", pct: 40 },
      { name: "Shelter", pct: 20 },
      { name: "Logistics", pct: 10 },
      { name: "Admin", pct: 2 },
    ].map((c, i) => ({ ...c, color: CAT_COLORS[i] })),
    story: [
      "Monsoon landslides cut off several mountain villages in Himachal Pradesh, injuring residents and blocking road access to the nearest hospitals. Parvat Sewa Sangh opened this fund to run medical camps and coordinate evacuation support across three affected districts.",
      "Donations move through UPI, same as any other payment. Only the record of where the money went is written to Monad — the fund never holds or moves cryptocurrency.",
    ],
    ledger: [
      { date: "Aug 11", desc: "Medical camp supplies — Shimla Pharma Distributors", category: "Medical", amount: 26000, hash: "0x71fa...2c88" },
      { date: "Aug 9", desc: "Helicopter evacuation fuel support", category: "Logistics", amount: 14000, hash: "0x22e5...bb31" },
      { date: "Aug 6", desc: "Emergency rations — Mandi Traders", category: "Food", amount: 9800, hash: "0x88a0...4477" },
    ],
    updates: [
      { date: "Aug 11, 2026", text: "Second medical camp opened in Kullu district, treating over 60 patients." },
      { date: "Aug 5, 2026", text: "Fund opened after landslides blocked the main highway in three districts." },
    ],
    donors: [
      { name: "Anonymous", amount: 3000 },
      { name: "Vikram S.", amount: 1000 },
      { name: "Anonymous", amount: 500 },
    ],
    mapLabel: "map: Kullu & Mandi districts, Himachal Pradesh — affected villages",
  },
};

/** Up to `limit` other campaigns, excluding the one at `slug`, for the "Other active campaigns" section. */
export function getRelatedCampaigns(slug: string, limit = 3): RelatedCampaign[] {
  return Object.values(CAMPAIGNS)
    .filter((c) => c.slug !== slug)
    .slice(0, limit)
    .map((c) => ({ slug: c.slug, location: c.region, name: c.name, blurb: c.story[0], raised: c.raised }));
}

export const AI_REPORT_RECORD: LedgerRow = {
  date: "Aug 14",
  desc: "Rice & lentils — Local Bhai Logistics",
  category: "Food",
  amount: 18400,
  hash: "0x7a3f...9e21",
};
