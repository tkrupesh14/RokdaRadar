import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

// Local filesystem + SHA-256 "CID" (LLD Section 6, MVP0 tier). The mechanism
// -- hash-then-reference -- is identical to the IPFS production path; only
// the storage backend differs.
//
// spendRef is only known *after* attestSpend returns on-chain, but
// evidenceCID must be computed and passed *into* that same call (LLD 4.1
// steps 2-4). So the file is content-addressed by its own SHA-256 hash first
// (true CAS, same as a real IPFS CID would be), and linkEvidenceToSpend()
// adds a spendRef-named pointer once the chain call completes.
export function saveEvidence(
  campaignId: number,
  buffer: Buffer,
  mimetype: string
): { cid: string; filePath: string } {
  const cid = crypto.createHash("sha256").update(buffer).digest("hex");
  const ext = EXT_BY_MIME[mimetype] ?? "bin";
  const dir = path.resolve(env.EVIDENCE_DIR, String(campaignId));
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${cid}.${ext}`);
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, buffer);
  return { cid, filePath };
}

export function linkEvidenceToSpend(campaignId: number, cid: string, spendRef: string, mimetype: string): void {
  const ext = EXT_BY_MIME[mimetype] ?? "bin";
  const dir = path.resolve(env.EVIDENCE_DIR, String(campaignId));
  const src = path.join(dir, `${cid}.${ext}`);
  const linkPath = path.join(dir, `${spendRef}.${ext}`);
  if (fs.existsSync(src) && !fs.existsSync(linkPath)) {
    fs.copyFileSync(src, linkPath);
  }
}
