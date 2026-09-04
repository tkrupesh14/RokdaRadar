import { describe, it, expect } from "vitest";
import request from "supertest";

// Validation happens before any DB access in the route (reportQuerySchema
// is checked first), so these don't need freshTestDb()/TEST_DATABASE_URL.
describe("GET /api/csr/report validation", () => {
  it("400s when format is missing", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const res = await request(app).get("/api/csr/report");
    expect(res.status).toBe(400);
  });

  it("400s on an unsupported format", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const res = await request(app).get("/api/csr/report?format=csv");
    expect(res.status).toBe(400);
  });

  it("400s on a malformed date shape", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const res = await request(app).get("/api/csr/report?format=pdf&from=01-01-2026");
    expect(res.status).toBe(400);
  });

  it("400s on a shape-valid but impossible calendar date", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    // Regression case: "2026-13-99" matches /^\d{4}-\d{2}-\d{2}$/ but isn't a
    // real date -- new Date() on it silently produces Invalid Date (NaN),
    // which would previously make every ts >= fromTs comparison false and
    // return a silently-empty report (200) instead of a clear error.
    const res = await request(app).get("/api/csr/report?format=pdf&from=2026-13-99");
    expect(res.status).toBe(400);
    expect(res.body.detail).toMatch(/valid calendar date/);
  });
});
