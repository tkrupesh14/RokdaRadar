import { env } from "../config/env.js";

export class RazorpayError extends Error {}

// Razorpay Orders API: https://razorpay.com/docs/api/orders/create/
// Authenticated with Basic Auth (key_id:key_secret) -- verified live
// against a real test-mode account while building this (see PR
// description). "amount" is in the smallest currency unit (paise for
// INR), matching this codebase's amountPaise convention everywhere else,
// so no conversion is needed at the call site.
export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
};

export async function createRazorpayOrder(amountPaise: number, notes: Record<string, string>): Promise<RazorpayOrder> {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new RazorpayError("Razorpay is not configured (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET unset)");
  }

  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  let res: Response;
  try {
    res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountPaise, currency: "INR", notes }),
    });
  } catch (err: any) {
    throw new RazorpayError(`Razorpay request failed: ${err?.message ?? "network error"}`);
  }

  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    amount?: number;
    currency?: string;
    status?: string;
    error?: { description?: string };
  };
  if (!res.ok) {
    throw new RazorpayError(body?.error?.description ?? `Razorpay returned ${res.status}`);
  }
  return { id: body.id!, amount: body.amount!, currency: body.currency!, status: body.status! };
}
