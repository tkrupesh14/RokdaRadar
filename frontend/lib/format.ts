export function fmtINR(n: number): string {
  return "₹" + Number(n).toLocaleString("en-IN");
}

// Backend amounts (aggregate.raisedPaise/spentPaise, feed item amountPaise,
// per LLD's paise convention) must be converted before assigning into any
// frontend field that fmtINR renders directly (CampaignDetail.raised/spent,
// LedgerRow.amount, CsrCampaign.raised/spent, Spend.amount, etc.) -- those
// fields are rupee-denominated, matching the original static mock data's
// scale (e.g. a modest relief fund raising "₹4,82,600", not paise).
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function shortHash(hash: string): string {
  return hash.length > 14 ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : hash;
}

const EXPLORER_TX_BASE_URL =
  process.env.NEXT_PUBLIC_MONAD_EXPLORER_TX_BASE_URL || "https://testnet.monadscan.com/tx";

export function explorerTxUrl(hash: string): string {
  return `${EXPLORER_TX_BASE_URL}/${hash}`;
}
