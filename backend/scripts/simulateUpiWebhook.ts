// Stands in for a real PSP (Razorpay/Cashfree) in MVP0: signs a mock
// payment.captured payload with WEBHOOK_HMAC_SECRET and POSTs it to the
// locally running API, exactly matching the LLD 7.1 webhook contract.
//
// Usage:
//   npx tsx scripts/simulateUpiWebhook.ts <campaignId> <amountPaise> [baseUrl]
import "dotenv/config";
import crypto from "node:crypto";

async function main() {
  const [campaignIdArg, amountArg, baseUrlArg] = process.argv.slice(2);
  if (!campaignIdArg || !amountArg) {
    console.error("Usage: tsx scripts/simulateUpiWebhook.ts <campaignId> <amountPaise> [baseUrl]");
    process.exitCode = 1;
    return;
  }

  const secret = process.env.WEBHOOK_HMAC_SECRET;
  if (!secret) {
    console.error("WEBHOOK_HMAC_SECRET is not set in backend/.env");
    process.exitCode = 1;
    return;
  }

  const baseUrl = baseUrlArg ?? `http://localhost:${process.env.PORT ?? 4000}`;

  const payload = {
    event: "payment.captured",
    payload: {
      payment: {
        id: `pay_${crypto.randomBytes(8).toString("hex")}`,
        amount: Number(amountArg),
        utr: crypto.randomInt(100000000000, 999999999999).toString(),
        vpa: "donor@upi",
        notes: { campaignId: campaignIdArg },
      },
    },
  };

  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const response = await fetch(`${baseUrl}/api/webhooks/upi`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Signature": signature },
    body: rawBody,
  });

  console.log(response.status, await response.text());
}

main();
