"use client";

import { useState } from "react";
import Link from "next/link";
import { CAMPAIGN_CHOICES, CATEGORY_CHOICES, INITIAL_OPERATORS, type Operator } from "@/lib/csrData";
import { fmtINR } from "@/lib/format";
import Logo from "@/components/Logo";

type Tab = "newCampaign" | "operators" | "assign" | "progress";
const TABS: { id: Tab; label: string }[] = [
  { id: "newCampaign", label: "New Campaign" },
  { id: "operators", label: "Operators" },
  { id: "assign", label: "Assignments" },
  { id: "progress", label: "Progress" },
];

type NewCampaign = { name: string; region: string; category: string };
type GeneratedCred = { name: string; id: string; pin: string };

export default function CsrTeamAdmin() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("newCampaign");

  // New Campaign tab
  const [cName, setCName] = useState("");
  const [cOrg, setCOrg] = useState("");
  const [cRegion, setCRegion] = useState("");
  const [cCategory, setCCategory] = useState(CATEGORY_CHOICES[0]);
  const [cTarget, setCTarget] = useState("");
  const [cStart, setCStart] = useState("");
  const [cEnd, setCEnd] = useState("");
  const [cDescription, setCDescription] = useState("");
  const [cCoverAttached, setCCoverAttached] = useState(false);
  const [newCampaigns, setNewCampaigns] = useState<NewCampaign[]>([]);
  const [campaignCreated, setCampaignCreated] = useState(false);

  // Operators tab
  const [opName, setOpName] = useState("");
  const [opPhone, setOpPhone] = useState("");
  const [operators, setOperators] = useState<Operator[]>(INITIAL_OPERATORS);
  const [generatedCred, setGeneratedCred] = useState<GeneratedCred | null>(null);

  // Assign tab
  const [assignOperatorId, setAssignOperatorId] = useState("");
  const [assignSelected, setAssignSelected] = useState<string[]>([]);

  const onCreateCampaign = () => {
    if (!(cName && cOrg && cRegion && cTarget)) return;
    setNewCampaigns((nc) => [{ name: cName, region: cRegion, category: cCategory }, ...nc]);
    setCampaignCreated(true);
    setCName("");
    setCOrg("");
    setCRegion("");
    setCTarget("");
    setCStart("");
    setCEnd("");
    setCDescription("");
    setCCoverAttached(false);
    setTimeout(() => setCampaignCreated(false), 3500);
  };

  const onAddOperator = () => {
    if (!(opName && opPhone)) return;
    const id = "OP-" + Math.floor(1000 + Math.random() * 9000);
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const rec: Operator = { id, name: opName, phone: opPhone, campaigns: [], spendsCount: 0, spendsValue: 0, evidenceRate: 0, rejected: 0, avgResponseHrs: 0, lastActive: "—" };
    setOperators((ops) => [...ops, rec]);
    setGeneratedCred({ name: opName, id, pin });
    setOpName("");
    setOpPhone("");
  };

  const onAssign = () => {
    if (!assignOperatorId || assignSelected.length === 0) return;
    setOperators((ops) =>
      ops.map((op) => (op.id === assignOperatorId ? { ...op, campaigns: [...new Set([...op.campaigns, ...assignSelected])] } : op)),
    );
    setAssignSelected([]);
  };

  if (!loggedIn) {
    return (
      <div style={{ fontFamily: "var(--font-body)", minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div className="card elev-lg" style={{ width: "100%", maxWidth: 380, padding: 32 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, color: "var(--color-accent-700)", marginBottom: 6 }}>
            RokdaRadar for CSR
          </div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 23, margin: "0 0 22px" }}>Team &amp; Campaigns</h1>
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
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "var(--font-body)", minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", fontSize: 13.5 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px clamp(16px,3vw,40px)", borderBottom: "1px solid var(--color-divider)", flexWrap: "wrap" }}>
        <Link href="/csr" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--color-text)" }}>
          <Logo height={22} />
          <span style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 400 }}>
            for CSR
          </span>
        </Link>
        <span style={{ fontSize: 12.5, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>{orgName}</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/csr" style={{ fontSize: 13, textDecoration: "none" }}>
            ← Dashboard
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => setLoggedIn(false)}>
            Sign out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px 96px" }}>
        <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 26, margin: "0 0 20px" }}>Team &amp; Campaigns</h1>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--color-divider)", marginBottom: 28 }}>
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: "10px 16px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "var(--font-heading)",
                  fontSize: 14,
                  color: active ? "var(--color-accent-700)" : "var(--color-text)",
                  borderBottom: `2px solid ${active ? "var(--color-accent)" : "transparent"}`,
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* TAB: New Campaign */}
        {activeTab === "newCampaign" && (
          <section style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
            {campaignCreated && (
              <div className="card elev-sm" style={{ padding: "14px 18px", background: "var(--color-accent-2-100)", color: "var(--color-accent-2-800)" }}>
                ✓ Campaign created and added to the portfolio.
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="field">
                <label>Campaign name</label>
                <input className="input" type="text" placeholder="e.g. Sindhudurg Cyclone Relief" value={cName} onChange={(e) => setCName(e.target.value)} />
              </div>
              <div className="field">
                <label>Organization</label>
                <input className="input" type="text" placeholder="Implementing NGO" value={cOrg} onChange={(e) => setCOrg(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="field">
                <label>Region / state</label>
                <input className="input" type="text" placeholder="e.g. Maharashtra" value={cRegion} onChange={(e) => setCRegion(e.target.value)} />
              </div>
              <div className="field">
                <label>Category focus</label>
                <select className="input csr-select" value={cCategory} onChange={(e) => setCCategory(e.target.value)}>
                  {CATEGORY_CHOICES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div className="field">
                <label>Target amount</label>
                <input className="input" type="number" placeholder="₹" value={cTarget} onChange={(e) => setCTarget(e.target.value)} />
              </div>
              <div className="field">
                <label>Start date</label>
                <input className="input" type="date" value={cStart} onChange={(e) => setCStart(e.target.value)} />
              </div>
              <div className="field">
                <label>End date</label>
                <input className="input" type="date" value={cEnd} onChange={(e) => setCEnd(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Description</label>
              <textarea className="input" rows={3} placeholder="What this campaign covers" value={cDescription} onChange={(e) => setCDescription(e.target.value)} />
            </div>
            <div className="field">
              <label>Cover photo</label>
              {cCoverAttached ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: "var(--radius-md)", background: "var(--color-surface)" }}>
                  <span>🖼️</span>
                  <span style={{ flex: 1 }}>Cover photo attached</span>
                  <button type="button" className="btn btn-ghost" onClick={() => setCCoverAttached(false)}>
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCCoverAttached(true)}
                  style={{ width: "100%", padding: 16, borderRadius: "var(--radius-md)", border: "1.5px dashed var(--color-divider)", background: "transparent", cursor: "pointer", color: "var(--color-text)" }}
                >
                  Attach a cover photo
                </button>
              )}
            </div>
            <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={!(cName && cOrg && cRegion && cTarget)} onClick={onCreateCampaign}>
              Create campaign
            </button>

            {newCampaigns.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginBottom: 10 }}>
                  Recently created
                </div>
                {newCampaigns.map((nc, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--color-divider)", fontSize: 13 }}>
                    <span>{nc.name}</span>
                    <span style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                      {nc.region} · {nc.category}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB: Operators */}
        {activeTab === "operators" && (
          <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div className="card" style={{ padding: 18, maxWidth: 480 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Add an operator</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input className="input" type="text" placeholder="Full name" value={opName} onChange={(e) => setOpName(e.target.value)} />
                <input className="input" type="tel" placeholder="Phone number" value={opPhone} onChange={(e) => setOpPhone(e.target.value)} />
                <button type="button" className="btn btn-primary" disabled={!(opName && opPhone)} onClick={onAddOperator}>
                  Generate ID &amp; PIN
                </button>
              </div>
            </div>

            {generatedCred && (
              <div className="card elev-sm" style={{ padding: "16px 18px", background: "var(--color-accent-2-100)", maxWidth: 480 }}>
                <div style={{ fontSize: 13, color: "var(--color-accent-2-800)" }}>Share these with {generatedCred.name} — shown only once.</div>
                <div style={{ display: "flex", gap: 20, marginTop: 8, fontFamily: "var(--font-heading)", fontSize: 17, color: "var(--color-accent-2-800)" }}>
                  <span>ID: {generatedCred.id}</span>
                  <span>PIN: {generatedCred.pin}</span>
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginBottom: 10 }}>
                Operators
              </div>
              {operators.map((op) => (
                <div key={op.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderTop: "1px solid var(--color-divider)" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{op.name}</div>
                    <div style={{ fontSize: 11.5, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                      {op.id} · {op.phone}
                    </div>
                  </div>
                  <span className="tag tag-outline">{op.campaigns.length} campaigns</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB: Assignments */}
        {activeTab === "assign" && (
          <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div className="card" style={{ padding: 18, maxWidth: 520 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Assign an operator to campaigns</div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Operator</label>
                <select className="input csr-select" value={assignOperatorId} onChange={(e) => setAssignOperatorId(e.target.value)}>
                  <option value="">Select an operator</option>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Campaigns</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {CAMPAIGN_CHOICES.map((cc) => {
                    const active = assignSelected.includes(cc.id);
                    return (
                      <button
                        key={cc.id}
                        type="button"
                        onClick={() =>
                          setAssignSelected((sel) => (active ? sel.filter((x) => x !== cc.id) : [...sel, cc.id]))
                        }
                        style={{
                          padding: "6px 12px",
                          borderRadius: 999,
                          border: `1px solid ${active ? "var(--color-accent)" : "var(--color-divider)"}`,
                          background: active ? "var(--color-accent-100)" : "transparent",
                          color: active ? "var(--color-accent-800)" : "var(--color-text)",
                          fontSize: 12.5,
                          cursor: "pointer",
                        }}
                      >
                        {cc.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button type="button" className="btn btn-primary" disabled={!(assignOperatorId && assignSelected.length > 0)} onClick={onAssign}>
                Assign
              </button>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginBottom: 10 }}>
                Current assignments
              </div>
              {operators.map((op) => (
                <div key={op.id} style={{ padding: "12px 0", borderTop: "1px solid var(--color-divider)" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>{op.name}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {op.campaigns.map((id) => (
                      <span key={id} className="tag tag-accent-2">
                        {CAMPAIGN_CHOICES.find((c) => c.id === id)?.name || id}
                      </span>
                    ))}
                    {op.campaigns.length === 0 && (
                      <span style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Not yet assigned</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB: Progress */}
        {activeTab === "progress" && (
          <section>
            <table className="table">
              <thead>
                <tr>
                  <th>Operator</th>
                  <th>Spends recorded</th>
                  <th>Evidence rate</th>
                  <th>Rejected</th>
                  <th>Avg. response</th>
                  <th>Campaigns</th>
                  <th>Last active</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((op) => (
                  <tr key={op.id}>
                    <td style={{ fontWeight: 600 }}>{op.name}</td>
                    <td>
                      {op.spendsCount} · {fmtINR(op.spendsValue)}
                    </td>
                    <td>{op.evidenceRate}%</td>
                    <td>{op.rejected}</td>
                    <td>{op.avgResponseHrs ? `${op.avgResponseHrs}h` : "—"}</td>
                    <td>{op.campaigns.length}</td>
                    <td>{op.lastActive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}
