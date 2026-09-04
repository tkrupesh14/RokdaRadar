import { env } from "../config/env.js";

export class PinFailedError extends Error {}

// Pinata's classic pinning REST API (stable and documented for years,
// distinct from their newer v3 "Files API"). Chosen over that newer API
// specifically because this integration can't be exercised against a live
// account in the environment it was written in (no PINATA_JWT available) --
// this endpoint's request/response shape is the one documented consistently
// enough to implement with confidence from spec alone. If a live account is
// available, verify pinFileToIPFS end-to-end before relying on this in
// production.
const PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

type PinataPinResponse = {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
};

// Returns the real IPFS CID Pinata assigns after pinning -- this becomes
// the evidenceCID passed on-chain to attestSpend, same role the SHA-256
// hash plays in the local-storage tier (LLD Section 6).
export async function pinFileToIPFS(buffer: Buffer, filename: string, mimetype: string): Promise<string> {
  if (!env.PINATA_JWT) {
    throw new PinFailedError("PINATA_JWT is not configured");
  }

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimetype }), filename);
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  let res: Response;
  try {
    res = await fetch(PIN_FILE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.PINATA_JWT}` },
      body: form,
    });
  } catch (err: any) {
    throw new PinFailedError(`Pinata request failed: ${err?.message ?? "network error"}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new PinFailedError(`Pinata returned ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as PinataPinResponse;
  if (!data.IpfsHash) {
    throw new PinFailedError("Pinata response missing IpfsHash");
  }
  return data.IpfsHash;
}
