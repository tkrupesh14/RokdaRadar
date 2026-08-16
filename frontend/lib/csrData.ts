export type CsrCampaign = {
  name: string;
  org: string;
  region: string;
  category: string;
  raised: number;
  spent: number;
  trust: number;
  anomaly: boolean;
};

export const CAT_COLORS: Record<string, string> = {
  Food: "var(--color-accent-500)",
  Water: "var(--color-accent-2-500)",
  Medical: "var(--color-accent-300)",
  Shelter: "var(--color-accent-2-300)",
  Logistics: "var(--color-accent-700)",
  Admin: "var(--color-neutral-400)",
};

export const CSR_CAMPAIGNS: CsrCampaign[] = [
  { name: "Wayanad Landslide Relief Fund", org: "Sahayog Trust", region: "Kerala", category: "Shelter", raised: 482600, spent: 342000, trust: 92, anomaly: false },
  { name: "Assam Flood Relief 2026", org: "Purbanchal Aid", region: "Assam", category: "Food", raised: 318000, spent: 210000, trust: 78, anomaly: false },
  { name: "Odisha Cyclone Rebuild Fund", org: "Tarang Foundation", region: "Odisha", category: "Shelter", raised: 512000, spent: 398000, trust: 65, anomaly: true },
  { name: "Himachal Landslide Emergency Fund", org: "Parvat Sewa Sangh", region: "Himachal Pradesh", category: "Medical", raised: 274000, spent: 190000, trust: 88, anomaly: false },
  { name: "Bihar Flood Response", org: "Ganga Seva Samiti", region: "Bihar", category: "Water", raised: 396000, spent: 301000, trust: 54, anomaly: true },
  { name: "Tamil Nadu Cyclone Relief", org: "Kadal Nala Trust", region: "Tamil Nadu", category: "Logistics", raised: 244000, spent: 176000, trust: 81, anomaly: false },
  { name: "Uttarakhand Landslide Fund", org: "Himalaya Raksha", region: "Uttarakhand", category: "Shelter", raised: 205000, spent: 140000, trust: 70, anomaly: false },
  { name: "Gujarat Flood Relief", org: "Sardar Sewa Trust", region: "Gujarat", category: "Food", raised: 409000, spent: 298000, trust: 95, anomaly: false },
];

export type CampaignChoice = { id: string; name: string };

export const CAMPAIGN_CHOICES: CampaignChoice[] = [
  { id: "wayanad", name: "Wayanad Landslide Relief Fund" },
  { id: "assam", name: "Assam Flood Relief 2026" },
  { id: "odisha", name: "Odisha Cyclone Rebuild Fund" },
  { id: "himachal", name: "Himachal Landslide Emergency Fund" },
  { id: "bihar", name: "Bihar Flood Response" },
  { id: "tamilnadu", name: "Tamil Nadu Cyclone Relief" },
];

export const CATEGORY_CHOICES = ["Food", "Water", "Medical", "Shelter", "Logistics", "Admin"];

export type Operator = {
  id: string;
  name: string;
  phone: string;
  campaigns: string[];
  spendsCount: number;
  spendsValue: number;
  evidenceRate: number;
  rejected: number;
  avgResponseHrs: number;
  lastActive: string;
};

export const INITIAL_OPERATORS: Operator[] = [
  { id: "OP-2291", name: "Arun Nair", phone: "98450 xxxxx", campaigns: ["wayanad"], spendsCount: 14, spendsValue: 186000, evidenceRate: 97, rejected: 1, avgResponseHrs: 3.2, lastActive: "Aug 14" },
  { id: "OP-4417", name: "Deepa Menon", phone: "97021 xxxxx", campaigns: ["assam", "bihar"], spendsCount: 9, spendsValue: 121000, evidenceRate: 89, rejected: 2, avgResponseHrs: 5.6, lastActive: "Aug 13" },
  { id: "OP-1183", name: "Suresh Patil", phone: "99230 xxxxx", campaigns: [], spendsCount: 0, spendsValue: 0, evidenceRate: 0, rejected: 0, avgResponseHrs: 0, lastActive: "—" },
];
