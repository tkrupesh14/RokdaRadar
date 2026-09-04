import { test, expect } from "@playwright/test";

// Smoke coverage for the donate flow (#16). Mocks the backend donate call
// at the network layer -- this checks that the three-beat UI (amount ->
// payment -> receipt) actually wires together through a real browser, not
// that the backend/contract behave correctly (separate test suites own
// that). Selectors deliberately match this repo's current markup (e.g. the
// tx-proof "hash chip" is a plain clickable element, not yet a button) --
// see issue #22 for follow-up accessibility work on this page.
const DONATE_SLUG = "wayanad-landslide-relief-fund"; // has a real backendId (0), see lib/campaigns.ts

test.describe("donate flow", () => {
  test("pick an amount, pay, and see a confirmed receipt with working tx-proof modal", async ({ page }) => {
    await page.route("**/api/campaigns/0/donate", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          paymentId: "pay_e2e",
          utr: "111111111111",
          amountPaise: 50000,
          campaignId: 0,
          status: "confirmed",
          txHash: "0x" + "a".repeat(64),
        }),
      });
    });

    await page.goto(`/campaign/${DONATE_SLUG}/donate`);

    await page.getByRole("heading", { name: "Choose an amount" }).waitFor();
    await page.getByRole("button", { name: "₹500", exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByText("Paying").waitFor();
    await page.getByRole("button", { name: "I’ve completed the payment" }).click();

    // Beat 3: receipt, confirmed via the mocked backend response above.
    // Beat 1's amount chips stay mounted alongside the receipt (independent
    // render conditions), so scope to the receipt section to avoid matching
    // the "₹500" chip button too.
    const receiptSection = page.locator("section", { hasText: "Confirmed on Monad" });
    await expect(receiptSection).toBeVisible();
    await expect(receiptSection.getByText("₹500")).toBeVisible();

    await receiptSection.locator(".hash-chip").click();

    const dialog = page.locator(".dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Transaction proof");

    await page.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
  });

  test("shows the backend's error message when the donation fails", async ({ page }) => {
    await page.route("**/api/campaigns/0/donate", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ error: "The contract rejected this transaction.", code: "CONTRACT_REVERT", detail: "inactive" }),
      });
    });

    await page.goto(`/campaign/${DONATE_SLUG}/donate`);
    await page.getByRole("button", { name: "₹100", exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "I’ve completed the payment" }).click();

    await expect(page.getByText(/inactive|contract rejected/i)).toBeVisible();
  });
});
