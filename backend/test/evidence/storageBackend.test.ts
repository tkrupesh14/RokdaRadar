import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Same env.ts module-reset pattern as pinataClient.test.ts / config/prodSecretsGuard.test.ts.
vi.mock("../../src/evidence/pinataClient.js", () => ({
  pinFileToIPFS: vi.fn(async () => "bafybeigdyrztest"),
  PinFailedError: class PinFailedError extends Error {},
}));

describe("evidence storage backend selection", () => {
  const originalEnv = { ...process.env };
  const tmpDir = path.join(os.tmpdir(), "relieftrace-test-evidence-backend");

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.env.EVIDENCE_DIR = tmpDir;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("defaults to the local filesystem backend and returns a SHA-256 CID", async () => {
    delete process.env.EVIDENCE_STORAGE_BACKEND;
    const { saveEvidence } = await import("../../src/evidence/storage.js");
    const { cid, filePath } = await saveEvidence(1, Buffer.from("hello"), "application/pdf");

    expect(cid).toMatch(/^[0-9a-f]{64}$/);
    expect(filePath).toBeDefined();
    expect(fs.existsSync(filePath!)).toBe(true);
  });

  it("uses Pinata and returns its CID when EVIDENCE_STORAGE_BACKEND=ipfs", async () => {
    process.env.EVIDENCE_STORAGE_BACKEND = "ipfs";
    process.env.PINATA_JWT = "test-jwt";
    const { saveEvidence } = await import("../../src/evidence/storage.js");
    const { pinFileToIPFS } = await import("../../src/evidence/pinataClient.js");

    const { cid, filePath } = await saveEvidence(1, Buffer.from("hello"), "application/pdf");

    expect(cid).toBe("bafybeigdyrztest");
    expect(filePath).toBeUndefined();
    expect(pinFileToIPFS).toHaveBeenCalledOnce();
    // Nothing written to disk on the ipfs backend.
    expect(fs.existsSync(tmpDir)).toBe(false);
  });

  it("linkEvidenceToSpend is a no-op on the ipfs backend", async () => {
    process.env.EVIDENCE_STORAGE_BACKEND = "ipfs";
    process.env.PINATA_JWT = "test-jwt";
    const { linkEvidenceToSpend } = await import("../../src/evidence/storage.js");

    await expect(linkEvidenceToSpend(1, "bafybeigdyrztest", "0xspend1", "application/pdf")).resolves.toBeUndefined();
    expect(fs.existsSync(tmpDir)).toBe(false);
  });

  it("refuses to boot with EVIDENCE_STORAGE_BACKEND=ipfs and no PINATA_JWT", async () => {
    process.env.EVIDENCE_STORAGE_BACKEND = "ipfs";
    delete process.env.PINATA_JWT;
    await expect(import("../../src/config/env.js")).rejects.toThrow(/PINATA_JWT/);
  });
});
