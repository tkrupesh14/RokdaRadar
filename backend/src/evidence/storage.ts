import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { pinFileToIPFS } from "./pinataClient.js";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

// spendRef is only known *after* attestSpend returns on-chain, but
// evidenceCID must be computed and passed *into* that same call (LLD 4.1
// steps 2-4). So the file is content-addressed by its own hash/CID first,
// and linkEvidenceToSpend() adds a spendRef-named pointer once the chain
// call completes -- only meaningful for the local backend, where a second
// lookup key is a real filesystem concern. On the ipfs backend the CID
// pinned to Pinata is already the sole, permanent reference (that's the
// point of real content-addressed storage), so linkEvidenceToSpend is a
// no-op there.
export async function saveEvidence(
  campaignId: number,
  buffer: Buffer,
  mimetype: string
): Promise<{ cid: string; filePath?: string }> {
  if (env.EVIDENCE_STORAGE_BACKEND === "ipfs") {
    const ext = EXT_BY_MIME[mimetype] ?? "bin";
    const cid = await pinFileToIPFS(buffer, `evidence-${campaignId}.${ext}`, mimetype);
    return { cid };
  }

  // Local filesystem + SHA-256 "CID" (LLD Section 6, MVP0 tier). The
  // mechanism -- hash-then-reference -- is identical to the IPFS path
  // above; only the storage backend and the addressing scheme's realness
  // differ (a SHA-256 hex digest is not a resolvable IPFS CID).
  const cid = crypto.createHash("sha256").update(buffer).digest("hex");
  const ext = EXT_BY_MIME[mimetype] ?? "bin";
  const dir = path.resolve(env.EVIDENCE_DIR, String(campaignId));
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${cid}.${ext}`);
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, buffer);
  return { cid, filePath };
}

export async function linkEvidenceToSpend(campaignId: number, cid: string, spendRef: string, mimetype: string): Promise<void> {
  if (env.EVIDENCE_STORAGE_BACKEND === "ipfs") return; // no-op: see saveEvidence's comment above

  const ext = EXT_BY_MIME[mimetype] ?? "bin";
  const dir = path.resolve(env.EVIDENCE_DIR, String(campaignId));
  const src = path.join(dir, `${cid}.${ext}`);
  const linkPath = path.join(dir, `${spendRef}.${ext}`);
  if (fs.existsSync(src) && !fs.existsSync(linkPath)) {
    fs.copyFileSync(src, linkPath);
  }
}
