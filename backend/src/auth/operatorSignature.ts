import { ethers } from "ethers";

export type SignedRequest = {
  address: string;
  nonce: string;
  timestamp: number;
  signature: string;
};

const MAX_SKEW_MS = 5 * 60 * 1000;

// Real, load-bearing recover-and-compare check (LLD implies operator identity
// gates createCampaign/attestSpend server-side, pre-flight, before the
// contract's own onlyOperator/onlyOracle backstops it on-chain). Canonical
// message: `${route}:${campaignId ?? ""}:${nonce}:${timestamp}`, EIP-191
// personal_sign. scripts/signOperatorRequest.ts produces valid signed
// requests for Swagger/manual testing since there is no frontend wallet UI.
export function buildCanonicalMessage(route: string, campaignId: string | number | null, nonce: string, timestamp: number): string {
  return `${route}:${campaignId ?? ""}:${nonce}:${timestamp}`;
}

export function verifySignedRequest(
  route: string,
  campaignId: string | number | null,
  body: SignedRequest
): { ok: true } | { ok: false; reason: string } {
  const { address, nonce, timestamp, signature } = body;
  if (!address || !nonce || !timestamp || !signature) {
    return { ok: false, reason: "missing address/nonce/timestamp/signature" };
  }

  if (Math.abs(Date.now() - timestamp) > MAX_SKEW_MS) {
    return { ok: false, reason: "timestamp outside allowed window" };
  }

  const message = buildCanonicalMessage(route, campaignId, nonce, timestamp);
  let recovered: string;
  try {
    recovered = ethers.verifyMessage(message, signature);
  } catch {
    return { ok: false, reason: "invalid signature" };
  }

  if (recovered.toLowerCase() !== address.toLowerCase()) {
    return { ok: false, reason: "signature does not match claimed address" };
  }

  return { ok: true };
}
