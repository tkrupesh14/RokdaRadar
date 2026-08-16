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
  },
};

export const RELATED_CAMPAIGNS: RelatedCampaign[] = [
  { slug: "assam-flood-relief-2026", location: "Assam", name: "Assam Flood Relief 2026", blurb: "Emergency food and shelter for families displaced by the Brahmaputra floods.", raised: 318000 },
  { slug: "odisha-cyclone-rebuild-fund", location: "Odisha", name: "Odisha Cyclone Rebuild Fund", blurb: "Rebuilding damaged homes and restoring power in coastal villages.", raised: 512000 },
  { slug: "himachal-landslide-emergency-fund", location: "Himachal Pradesh", name: "Himachal Landslide Emergency Fund", blurb: "Medical aid and evacuation support across three districts.", raised: 274000 },
];

export const AI_REPORT_RECORD: LedgerRow = {
  date: "Aug 14",
  desc: "Rice & lentils — Local Bhai Logistics",
  category: "Food",
  amount: 18400,
  hash: "0x7a3f...9e21",
};
