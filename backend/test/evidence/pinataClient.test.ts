import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "dotenv/config";

// Same pattern as test/config/prodSecretsGuard.test.ts: env.ts reads
// process.env at import time and caches it, so exercising PINATA_JWT
// present-vs-absent needs a module reset + fresh dynamic import between
// cases, restoring process.env after each.
describe("pinFileToIPFS", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it("throws without attempting a request when PINATA_JWT is unset", async () => {
    delete process.env.PINATA_JWT;
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { pinFileToIPFS, PinFailedError } = await import("../../src/evidence/pinataClient.js");
    await expect(pinFileToIPFS(Buffer.from("x"), "f.pdf", "application/pdf")).rejects.toThrow(PinFailedError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the IpfsHash from a successful pin", async () => {
    process.env.PINATA_JWT = "test-jwt";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ IpfsHash: "bafybeigdyrztest", PinSize: 123, Timestamp: "2026-01-01T00:00:00Z" }),
    }) as unknown as typeof fetch;

    const { pinFileToIPFS } = await import("../../src/evidence/pinataClient.js");
    const cid = await pinFileToIPFS(Buffer.from("x"), "f.pdf", "application/pdf");
    expect(cid).toBe("bafybeigdyrztest");

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("https://api.pinata.cloud/pinning/pinFileToIPFS");
    expect(call[1].headers.Authorization).toBe("Bearer test-jwt");
  });

  it("throws when Pinata returns a non-ok status", async () => {
    process.env.PINATA_JWT = "test-jwt";
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "invalid API key",
    }) as unknown as typeof fetch;

    const { pinFileToIPFS, PinFailedError } = await import("../../src/evidence/pinataClient.js");
    await expect(pinFileToIPFS(Buffer.from("x"), "f.pdf", "application/pdf")).rejects.toThrow(PinFailedError);
  });

  it("throws when the response is missing IpfsHash", async () => {
    process.env.PINATA_JWT = "test-jwt";
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;

    const { pinFileToIPFS, PinFailedError } = await import("../../src/evidence/pinataClient.js");
    await expect(pinFileToIPFS(Buffer.from("x"), "f.pdf", "application/pdf")).rejects.toThrow(PinFailedError);
  });

  it("wraps a network error as PinFailedError", async () => {
    process.env.PINATA_JWT = "test-jwt";
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNRESET")) as unknown as typeof fetch;

    const { pinFileToIPFS, PinFailedError } = await import("../../src/evidence/pinataClient.js");
    await expect(pinFileToIPFS(Buffer.from("x"), "f.pdf", "application/pdf")).rejects.toThrow(PinFailedError);
  });
});
