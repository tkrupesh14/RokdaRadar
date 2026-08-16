import { attestorAllowlist } from "../config/env.js";
import { verifySignedRequest, type SignedRequest } from "./operatorSignature.js";

// Lightest of the three auth mechanisms, deliberately: LLD/HLD both defer a
// real attestor registry to MVP2+, so a static env-configured address list is
// the faithful MVP0 stand-in rather than a DB-backed roles table.
export function verifyAttestor(
  route: string,
  campaignId: string | number,
  body: SignedRequest
): { ok: true } | { ok: false; reason: string } {
  const sigCheck = verifySignedRequest(route, campaignId, body);
  if (!sigCheck.ok) return sigCheck;

  if (attestorAllowlist.length === 0) {
    // No allowlist configured: MVP0 demo default is open (any validly-signed
    // request may attest delivery). Configure ATTESTOR_ALLOWLIST to restrict.
    return { ok: true };
  }

  if (!attestorAllowlist.includes(body.address.toLowerCase())) {
    return { ok: false, reason: "address not in attestor allowlist" };
  }

  return { ok: true };
}
