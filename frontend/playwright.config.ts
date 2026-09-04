import { defineConfig, devices } from "@playwright/test";

// Smoke-level E2E coverage (issue #16). Deliberately doesn't depend on a
// live backend or chain: every test mocks backend fetch responses via
// page.route() so it can run in CI without TEST_DATABASE_URL/a funded
// testnet key (see #14) -- these tests check that the real UI wires the
// donate/spend-recording/report flows together correctly, not that the
// backend or contract are correct (that's the backend/contract test
// suites' job).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  // A single desktop project is enough for smoke coverage; the one test
  // that specifically needs a mobile viewport (the WalletConnect path) opts
  // into it per-file with test.use(devices["Pixel 7"]) instead of doubling
  // every other test's runtime with a second project.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
