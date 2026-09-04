import { test, expect, devices } from "@playwright/test";
import { mockInjectedWallet } from "./mockWallet";

// Smoke coverage for "operator wallet connect + spend recording" (#16).
// Uses a mobile viewport so EvidenceCapture takes its simple
// <input type=file capture> path instead of a live getUserMedia camera
// preview (see components/EvidenceCapture.tsx) -- unrelated to wallet
// connection, which is mocked the same way regardless of viewport (see
// walletconnect.spec.ts for the no-injected-provider mobile path).
test.use({ ...devices["Pixel 7"] });

test.describe("operator console: wallet connect + spend recording", () => {
  test("connects a wallet, submits a spend with evidence, and shows it confirmed", async ({ page }) => {
    await mockInjectedWallet(page);

    await page.route("**/api/campaigns/0/feed*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
    });
    await page.route("**/api/campaigns/0/spend", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ txHash: "0x" + "b".repeat(64), explorerUrl: "https://testnet.monadscan.com/tx/0x" + "b".repeat(64) }),
      });
    });

    await page.goto("/operator");

    await page.getByRole("button", { name: "Connect wallet" }).click();
    await expect(page.getByRole("heading", { name: "Record a spend" })).toBeVisible();

    // The operator page's <label>/<input> pairs aren't programmatically
    // associated (no htmlFor/id -- a separate, pre-existing a11y gap outside
    // this issue's scope), so locate by placeholder rather than getByLabel.
    await page.getByPlaceholder("e.g. Local Bhai Logistics").fill("E2E Test Vendor");
    await page.getByPlaceholder("₹").fill("1500");
    await page.getByRole("button", { name: "Food", exact: true }).click();

    await page.locator('input[type="file"]').setInputFiles({
      name: "evidence.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), // minimal valid JPEG SOI/EOI marker pair
    });

    const submit = page.getByRole("button", { name: "Record spend" });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByText("Spend recorded with evidence — syncing to the ledger.")).toBeVisible();
    await expect(page.getByText("E2E Test Vendor")).toBeVisible();
    await expect(page.getByText("Confirmed ·")).toBeVisible();
  });

  test("surfaces the backend's error instead of silently failing", async ({ page }) => {
    await mockInjectedWallet(page);
    await page.route("**/api/campaigns/0/feed*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
    });
    await page.route("**/api/campaigns/0/spend", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "UNAUTHORIZED", detail: "signature does not match authAddress" }),
      });
    });

    await page.goto("/operator");
    await page.getByRole("button", { name: "Connect wallet" }).click();

    await page.getByPlaceholder("e.g. Local Bhai Logistics").fill("Bad Vendor");
    await page.getByPlaceholder("₹").fill("100");
    await page.getByRole("button", { name: "Medical", exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "evidence.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    await page.getByRole("button", { name: "Record spend" }).click();

    await expect(page.getByText("signature does not match authAddress")).toBeVisible();
  });
});
