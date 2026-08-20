import { managerAllowlist } from "../config/env.js";
import { verifySignedRequest, type SignedRequest } from "./operatorSignature.js";

// Same shape as auth/attestorAllowlist.ts: a static env-configured address
// list gates who may approve/reject a pending spend. The actual attestSpend
// call still executes via the backend's own operator signer (chain/provider.ts)
// on approval -- this only decides who is allowed to trigger that, since the
// contract itself has no notion of a "manager" role to check on-chain.
export function verifyManager(
  route: string,
  campaignId: string | number,
  body: SignedRequest
): { ok: true } | { ok: false; reason: string } {
  const sigCheck = verifySignedRequest(route, campaignId, body);
  if (!sigCheck.ok) return sigCheck;

  if (managerAllowlist.length === 0) {
    // No allowlist configured: MVP0 demo default is open (any validly-signed
    // request may review). Configure MANAGER_ALLOWLIST to restrict.
    return { ok: true };
  }

  if (!managerAllowlist.includes(body.address.toLowerCase())) {
    return { ok: false, reason: "address not in manager allowlist" };
  }

  return { ok: true };
}
