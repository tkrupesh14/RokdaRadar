import { test, expect, devices } from "@playwright/test";

// Smoke coverage for the mobile WalletConnect path added this session
// (#16): a mobile browser with no injected window.ethereum falls back to
// WalletConnect (see lib/wallet.ts's connectWallet()). This deliberately
// does NOT try to complete a real pairing -- that needs an actual wallet
// app scanning a QR code, which no CI environment can do. It only checks
// that entering this code path doesn't crash and that the app shows some
// definite outcome (the WalletConnect UI actually mounting, or a clear
// error if the relay can't be reached in this environment) rather than
// hanging silently forever.
test.use({ ...devices["Pixel 7"] });

test.describe("operator console: WalletConnect fallback (no injected wallet)", () => {
  test("clicking connect enters the WalletConnect flow without crashing", async ({ page }) => {
    // Depends on reaching WalletConnect's relay over the real network (see
    // comment above) -- give it more room than the default 30s.
    test.setTimeout(60_000);
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto("/operator");
    await page.getByRole("button", { name: "Connect wallet" }).click();

    // "Connecting…" proves onConnectWallet() ran and window.ethereum was
    // absent (no injected provider was mocked for this test), so
    // connectWallet() took the getWalletConnectProvider() branch.
    await expect(page.getByRole("button", { name: "Connecting…" })).toBeVisible();

    // From here the outcome depends on real network access to WalletConnect's
    // relay, which varies by environment -- accept either the WalletConnect
    // widget actually mounting (its bundle renders a QR/connect UI, commonly
    // via a <canvas> QR code or a wcm-modal/w3m-modal custom element) or a
    // clear, non-crashing error surfaced in the app's own UI.
    const wcWidgetAppeared = page
      .locator("canvas, wcm-modal, w3m-modal, [id^='wcm-'], [id^='w3m-']")
      .first()
      .waitFor({ state: "attached", timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    const connectErrorAppeared = page
      .getByText(/wallet connect|could not connect/i)
      .first()
      .waitFor({ state: "visible", timeout: 20_000 })
      .then(() => true)
      .catch(() => false);

    const outcome = await Promise.race([wcWidgetAppeared, connectErrorAppeared]);
    expect(outcome).toBe(true);
    expect(pageErrors).toEqual([]);
  });
});
