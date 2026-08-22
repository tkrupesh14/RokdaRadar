import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "dotenv/config";

// Same env.ts module-reset pattern as test/config/prodSecretsGuard.test.ts /
// test/evidence/pinataClient.test.ts: env.ts caches process.env at import
// time, so exercising RAZORPAY_KEY_ID present-vs-absent needs a fresh
// dynamic import per case.
describe("createRazorpayOrder", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it("throws without attempting a request when credentials are unset", async () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { createRazorpayOrder, RazorpayError } = await import("../../src/payments/razorpay.js");
    await expect(createRazorpayOrder(50000, { campaignId: "0" })).rejects.toThrow(RazorpayError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("creates an order with correct Basic Auth and request body, and returns its fields", async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
    process.env.RAZORPAY_KEY_SECRET = "secretxyz";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "order_test123", amount: 50000, currency: "INR", status: "created" }),
    }) as unknown as typeof fetch;

    const { createRazorpayOrder } = await import("../../src/payments/razorpay.js");
    const order = await createRazorpayOrder(50000, { campaignId: "0" });
    expect(order).toEqual({ id: "order_test123", amount: 50000, currency: "INR", status: "created" });

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("https://api.razorpay.com/v1/orders");
    expect(call[1].headers.Authorization).toBe(`Basic ${Buffer.from("rzp_test_abc:secretxyz").toString("base64")}`);
    const body = JSON.parse(call[1].body);
    expect(body).toEqual({ amount: 50000, currency: "INR", notes: { campaignId: "0" } });
  });

  it("throws with Razorpay's error description on a non-ok response", async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
    process.env.RAZORPAY_KEY_SECRET = "secretxyz";
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { description: "amount must be at least 100" } }),
    }) as unknown as typeof fetch;

    const { createRazorpayOrder, RazorpayError } = await import("../../src/payments/razorpay.js");
    await expect(createRazorpayOrder(1, { campaignId: "0" })).rejects.toThrow(/amount must be at least 100/);
    await expect(createRazorpayOrder(1, { campaignId: "0" })).rejects.toThrow(RazorpayError);
  });

  it("wraps a network error as RazorpayError", async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
    process.env.RAZORPAY_KEY_SECRET = "secretxyz";
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNRESET")) as unknown as typeof fetch;

    const { createRazorpayOrder, RazorpayError } = await import("../../src/payments/razorpay.js");
    await expect(createRazorpayOrder(50000, { campaignId: "0" })).rejects.toThrow(RazorpayError);
  });
});
