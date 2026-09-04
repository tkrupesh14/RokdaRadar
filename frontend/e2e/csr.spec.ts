import { test, expect } from "@playwright/test";

// Smoke coverage for "CSR report viewing" (#16): sign in to the CSR
// compliance dashboard and open the board-report dialog.
test.describe("CSR dashboard: report viewing", () => {
  test("signs in and opens the board report dialog", async ({ page }) => {
    // getAggregate() is called for every campaign with a backendId on
    // mount; stub it so the portfolio table doesn't depend on a live
    // backend.
    await page.route("**/api/campaigns/*/aggregate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ raisedPaise: 100000, spentPaise: 50000, anomalyCandidates: [] }),
      });
    });

    await page.goto("/csr");

    await page.getByRole("heading", { name: "Compliance Dashboard" }).waitFor();
    await page.getByPlaceholder("you@company.com").fill("compliance@example.org");
    await page.getByPlaceholder("Company name").fill("Example Corp");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Total disbursed")).toBeVisible();

    await page.getByRole("button", { name: "Generate Board Report" }).click();

    const dialog = page.getByRole("dialog").or(page.locator(".dialog"));
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Board Report");
    await expect(dialog).toContainText("Portfolio summary");

    await page.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
  });
});
