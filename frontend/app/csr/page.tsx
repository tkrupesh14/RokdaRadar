"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CAT_COLORS, CSR_CAMPAIGNS, type CsrCampaign } from "@/lib/csrData";
import { getAggregate } from "@/lib/api";
import { fmtINR, paiseToRupees } from "@/lib/format";
import Logo from "@/components/Logo";

type TrustFilter = "all" | "high" | "mid" | "low";
type AnomalyFilter = "all" | "flagged" | "clear";

export default function CsrDashboard() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");

  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [trustFilter, setTrustFilter] = useState<TrustFilter>("all");
  const [anomalyFilter, setAnomalyFilter] = useState<AnomalyFilter>("all");
  const [reportOpen, setReportOpen] = useState(false);

  // Overlays real raised/spent/anomaly data from the backend for any entry
  // with a backendId (currently just Wayanad -- see lib/csrData.ts). org/
  // region/category/trust have no backend equivalent yet and stay static.
  // Falls back to the untouched mock row if the backend has no campaign
  // there yet, which is expected until a real on-chain campaign is created.
  const [campaigns, setCampaigns] = useState<CsrCampaign[]>(CSR_CAMPAIGNS);

  useEffect(() => {
    // Explicit undefined check: campaignId 0 is a valid real backend id
    // (contract's campaignCount starts at 0) and a truthy check would wrongly
    // skip it since 0 is falsy in JS.
    const withBackendId = CSR_CAMPAIGNS.filter((c) => c.backendId !== undefined);
    if (withBackendId.length === 0) return;

    let cancelled = false;
    Promise.all(withBackendId.map((c) => getAggregate(c.backendId!))).then((results) => {
      if (cancelled) return;
      setCampaigns((prev) =>
        prev.map((c) => {
          const idx = withBackendId.indexOf(c);
          const aggregate = idx >= 0 ? results[idx] : null;
          if (!aggregate) return c;
          return {
            ...c,
            raised: paiseToRupees(aggregate.raisedPaise),
            spent: paiseToRupees(aggregate.spentPaise),
            anomaly: aggregate.anomalyCandidates.length > 0,
          };
        })
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (region !== "all" && c.region !== region) return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      if (trustFilter === "high" && c.trust < 80) return false;
      if (trustFilter === "mid" && (c.trust < 60 || c.trust >= 80)) return false;
      if (trustFilter === "low" && c.trust >= 60) return false;
      if (anomalyFilter === "flagged" && !c.anomaly) return false;
      if (anomalyFilter === "clear" && c.anomaly) return false;
      return true;
    });
  }, [campaigns, search, region, categoryFilter, trustFilter, anomalyFilter]);

  const regionOptions = useMemo(() => [...new Set(CSR_CAMPAIGNS.map((c) => c.region))], []);
  const categoryOptions = useMemo(() => [...new Set(CSR_CAMPAIGNS.map((c) => c.category))], []);

  const { donutGradient, categoryLegend } = useMemo(() => {
    const catTotals: Record<string, number> = {};
    campaigns.forEach((c) => {
      catTotals[c.category] = (catTotals[c.category] || 0) + c.spent;
    });
    const totalSpent = Object.values(catTotals).reduce((a, b) => a + b, 0);
    const legend = Object.entries(catTotals).map(([name, v]) => ({
      name,
      pct: Math.round((v / totalSpent) * 100),
      color: CAT_COLORS[name] || "var(--color-neutral-400)",
    }));
    let acc = 0;
    const parts = legend.map((c) => {
      const start = acc;
      acc += c.pct;
      return `${c.color} ${start}% ${acc}%`;
    });
    return { donutGradient: `conic-gradient(${parts.join(",")})`, categoryLegend: legend };
  }, [campaigns]);

  const regionBars = useMemo(() => {
    const regionTotals: Record<string, number> = {};
    campaigns.forEach((c) => {
      regionTotals[c.region] = (regionTotals[c.region] || 0) + c.raised;
    });
    const maxRegion = Math.max(...Object.values(regionTotals));
    return Object.entries(regionTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, v]) => ({ name, amountDisplay: fmtINR(v), pct: Math.round((v / maxRegion) * 100) }));
  }, [campaigns]);

  const { trendPoints, trendDots } = useMemo(() => {
    const trendVals = [42, 55, 48, 63, 71, 86];
    const maxTrend = Math.max(...trendVals);
    const dots = trendVals.map((v, i) => ({ x: 10 + i * 48, y: 100 - (v / maxTrend) * 80 }));
    return { trendDots: dots, trendPoints: dots.map((p) => `${p.x},${p.y}`).join(" ") };
  }, []);

  if (!loggedIn) {
    return (
      <div style={{ fontFamily: "var(--font-body)", minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div className="card elev-lg" style={{ width: "100%", maxWidth: 380, padding: 32 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, color: "var(--color-accent-700)", marginBottom: 6 }}>
            RokdaRadar for CSR
          </div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 23, margin: "0 0 22px" }}>Compliance Dashboard</h1>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Work email</label>
            <input className="input" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label>Organization</label>
            <input className="input" type="text" placeholder="Company name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          </div>
          <button type="button" className="btn btn-primary btn-block" disabled={!(email && orgName)} onClick={() => setLoggedIn(true)}>
            Sign in
          </button>
          <p style={{ fontSize: 12, lineHeight: "19px", color: "color-mix(in srgb, var(--color-text) 60%, transparent)", margin: "16px 0 0" }}>
            For registered CSR compliance teams. Public donors use the campaign page instead.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "var(--font-body)", minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", fontSize: 13.5 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px clamp(16px,3vw,40px)", borderBottom: "1px solid var(--color-divider)", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Logo height={22} />
          <span style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 400 }}>
            for CSR
          </span>
        </span>
        <span style={{ fontSize: 12.5, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>{orgName}</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <Link className="btn btn-ghost" href="/csr/admin">
            Team &amp; Campaigns
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => setReportOpen(true)}>
            Generate Board Report
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setLoggedIn(false)}>
            Sign out
          </button>
        </div>
      </header>

      <div style={{ padding: "24px clamp(16px,3vw,40px) 80px" }}>
        {/* Portfolio summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 28 }}>
          <div className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>Total disbursed</div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 21, marginTop: 6 }}>₹86,40,000</div>
          </div>
          <div className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>Campaigns supported</div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 21, marginTop: 6 }}>8</div>
          </div>
          <div className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>Avg. trust score</div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 21, marginTop: 6, color: "var(--color-accent-2-700)" }}>78</div>
          </div>
          <div className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>Anomalies</div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 21, marginTop: 6, color: "var(--color-accent-800)" }}>
              2 open <span style={{ fontSize: 12, fontFamily: "var(--font-body)", fontWeight: 400, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>/ 5 resolved</span>
            </div>
          </div>
          <div className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>Spend with evidence</div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 21, marginTop: 6 }}>96%</div>
          </div>
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 16, marginBottom: 32 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 14 }}>Funds by category</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 100, height: 100, borderRadius: "50%", flexShrink: 0, background: donutGradient }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {categoryLegend.map((c) => (
                  <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, display: "inline-block" }} />
                    {c.name} {c.pct}%
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 14 }}>Funds by region</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {regionBars.map((r) => (
                <div key={r.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                    <span>{r.name}</span>
                    <span>{r.amountDisplay}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "var(--color-neutral-200)" }}>
                    <div style={{ height: "100%", width: `${r.pct}%`, borderRadius: 999, background: "var(--color-accent-500)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 14 }}>Disbursement trend, last 6 months</div>
            <svg viewBox="0 0 260 110" style={{ width: "100%", height: 110 }}>
              <polyline points={trendPoints} fill="none" stroke="var(--color-accent-500)" strokeWidth={2.5} />
              {trendDots.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--color-accent-700)" />
              ))}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginTop: 4 }}>
              <span>Mar</span>
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
              <span>Jul</span>
              <span>Aug</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 16 }}>
          <input className="input csr-select" style={{ width: 200 }} type="text" placeholder="Search campaigns…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input csr-select" style={{ width: "auto" }} value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="all">All regions</option>
            {regionOptions.map((rg) => (
              <option key={rg} value={rg}>
                {rg}
              </option>
            ))}
          </select>
          <select className="input csr-select" style={{ width: "auto" }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All categories</option>
            {categoryOptions.map((cg) => (
              <option key={cg} value={cg}>
                {cg}
              </option>
            ))}
          </select>
          <select className="input csr-select" style={{ width: "auto" }} value={trustFilter} onChange={(e) => setTrustFilter(e.target.value as TrustFilter)}>
            <option value="all">Any trust score</option>
            <option value="high">80+</option>
            <option value="mid">60–79</option>
            <option value="low">Below 60</option>
          </select>
          <select className="input csr-select" style={{ width: "auto" }} value={anomalyFilter} onChange={(e) => setAnomalyFilter(e.target.value as AnomalyFilter)}>
            <option value="all">Any status</option>
            <option value="flagged">Flagged</option>
            <option value="clear">Clear</option>
          </select>
          <select className="input csr-select" style={{ width: "auto" }}>
            <option>All time</option>
            <option>Last 30 days</option>
            <option>Last 7 days</option>
          </select>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>{filtered.length} campaigns</span>
        </div>

        {/* Campaign grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
          {filtered.map((c) => {
            const trustColor = c.trust >= 80 ? "var(--color-accent-2-700)" : c.trust >= 60 ? "var(--color-accent-700)" : "var(--color-accent-800)";
            const cardBody = (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span className="card-kicker">{c.org}</span>
                  {c.anomaly && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "var(--color-accent-100)", color: "var(--color-accent-800)" }}>
                      Flagged
                    </span>
                  )}
                </div>
                <h3 className="card-title" style={{ fontSize: 15 }}>
                  {c.name}
                </h3>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="tag tag-outline">{c.region}</span>
                  <span className="tag tag-accent-2">{c.category}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: 11, marginTop: 4 }}>
                  <div>
                    <div style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Raised</div>
                    <div style={{ fontWeight: 600 }}>{fmtINR(c.raised)}</div>
                  </div>
                  <div>
                    <div style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Spent</div>
                    <div style={{ fontWeight: 600 }}>{fmtINR(c.spent)}</div>
                  </div>
                  <div>
                    <div style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Left</div>
                    <div style={{ fontWeight: 600 }}>{fmtINR(c.raised - c.spent)}</div>
                  </div>
                </div>
                <div className="card-meta" style={{ marginTop: 2 }}>
                  Trust score <b style={{ color: trustColor, marginLeft: 3 }}>{c.trust}</b>
                </div>
              </>
            );
            return c.slug ? (
              <Link key={c.name} href={`/campaign/${c.slug}`} className="card elev-sm" style={{ padding: 16, gap: 10, color: "inherit", textDecoration: "none", cursor: "pointer" }}>
                {cardBody}
              </Link>
            ) : (
              <div key={c.name} className="card elev-sm" style={{ padding: 16, gap: 10 }}>
                {cardBody}
              </div>
            );
          })}
        </div>
      </div>

      {reportOpen && (
        <div className="dialog-backdrop" style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={() => setReportOpen(false)}>
          <div className="dialog" style={{ width: "min(480px,100%)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="dialog-title">Board Report — August 2026</h3>
            <div className="dialog-body">
              <p style={{ margin: "0 0 10px" }}>This report will include:</p>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                <li>Portfolio summary — 8 campaigns, ₹86,40,000 disbursed</li>
                <li>Campaign-by-campaign breakdown with trust scores</li>
                <li>2 open anomalies with current status</li>
                <li>Funds-by-category and funds-by-region charts</li>
                <li>Auditor sign-off page</li>
              </ul>
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setReportOpen(false)}>
                Close
              </button>
              <button type="button" className="btn btn-primary">
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
