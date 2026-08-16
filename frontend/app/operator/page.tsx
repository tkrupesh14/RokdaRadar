"use client";

import { useState } from "react";

const CATEGORY_NAMES = ["Food", "Water", "Medical", "Shelter", "Logistics", "Admin"];

type Spend = {
  id: number;
  vendor: string;
  category: string;
  amount: number;
  date: string;
  status: "confirmed" | "pending";
  hash?: string;
};

const INITIAL_SPENDS: Spend[] = [
  { id: 1, vendor: "Local Bhai Logistics", category: "Food", amount: 18400, date: "Aug 14", status: "confirmed", hash: "0x7a3f...9e21" },
  { id: 2, vendor: "Kerala Tarp Co.", category: "Shelter", amount: 26000, date: "Aug 12", status: "confirmed", hash: "0x2f8b...c110" },
  { id: 3, vendor: "Wayanad Medical Store", category: "Medical", amount: 9800, date: "Aug 10", status: "confirmed", hash: "0x66e0...ab77" },
];

function fmtINR(n: number) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

function fakeHash() {
  const h = () => Math.random().toString(16).slice(2, 6);
  return "0x" + h() + "..." + h();
}

export default function OperatorConsole() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [operatorId, setOperatorId] = useState("");
  const [pin, setPin] = useState("");
  const [campaign, setCampaign] = useState("wayanad");
  const [online, setOnline] = useState(true);

  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("2026-08-15");
  const [category, setCategory] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [evidenceAttached, setEvidenceAttached] = useState(false);

  const [spends, setSpends] = useState<Spend[]>(INITIAL_SPENDS);
  const [justSubmitted, setJustSubmitted] = useState<number | null>(null);
  const [showRejectToast, setShowRejectToast] = useState(false);

  const canSubmit = !!(vendor && Number(amount) > 0 && category && evidenceAttached);

  const onLogin = () => {
    if (operatorId && pin) setLoggedIn(true);
  };
  const onLogout = () => {
    setLoggedIn(false);
    setOperatorId("");
    setPin("");
  };

  const onSubmit = () => {
    if (!canSubmit || !category) return;
    const rec: Spend = { id: Date.now(), vendor, category, amount: Number(amount), date, status: "pending" };
    setSpends((s) => [rec, ...s]);
    setJustSubmitted(rec.id);
    setVendor("");
    setAmount("");
    setCategory(null);
    setMemo("");
    setEvidenceAttached(false);

    setTimeout(() => {
      setSpends((s) => s.map((sp) => (sp.id === rec.id ? { ...sp, status: "confirmed", hash: fakeHash() } : sp)));
    }, 1400);
    setTimeout(() => setJustSubmitted(null), 4000);
  };

  const onDemoReject = () => {
    setShowRejectToast(true);
    setTimeout(() => setShowRejectToast(false), 3500);
  };

  if (!loggedIn) {
    return (
      <div style={{ fontFamily: "var(--font-body)", minHeight: "100vh", background: "var(--color-neutral-900)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div className="card elev-lg" style={{ width: "100%", maxWidth: 360, padding: 32 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, color: "var(--color-accent-700)", marginBottom: 6 }}>
            ReliefTrace — internal access
          </div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 24, margin: "0 0 22px" }}>Operator Console</h1>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Operator ID</label>
            <input className="input" type="text" placeholder="OP-2291" value={operatorId} onChange={(e) => setOperatorId(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label>PIN</label>
            <input className="input" type="password" placeholder="4-digit PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
          </div>
          <button type="button" className="btn btn-primary btn-block" disabled={!(operatorId && pin)} onClick={onLogin}>
            Log in
          </button>
          <p style={{ fontSize: 12, lineHeight: "19px", color: "color-mix(in srgb, var(--color-text) 60%, transparent)", margin: "16px 0 0" }}>
            Access is limited to verified relief operators. Donors and the public use the campaign page instead.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "var(--font-body)", minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "16px clamp(16px,4vw,40px)", background: "var(--color-neutral-900)", color: "var(--color-neutral-100)" }}>
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 17 }}>ReliefTrace Operator</span>
        <select
          className="op-select input"
          style={{ width: "auto", maxWidth: 220, background: "var(--color-neutral-800)", color: "var(--color-neutral-100)", borderColor: "var(--color-neutral-700)" }}
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
        >
          <option value="wayanad">Wayanad Landslide Relief Fund</option>
          <option value="assam">Assam Flood Relief 2026</option>
          <option value="odisha">Odisha Cyclone Rebuild Fund</option>
        </select>
        <span onClick={() => setOnline((o) => !o)} style={{ cursor: "pointer", fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "var(--color-neutral-800)" }}>
          {online ? "🟢 Online" : "📶 Poor connection — will sync later"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--color-neutral-300)" }}>{operatorId}</span>
          <button type="button" className="btn btn-secondary" style={{ background: "transparent", borderColor: "var(--color-neutral-700)", color: "var(--color-neutral-100)" }} onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 96px" }}>
        {justSubmitted !== null && (
          <div className="card elev-sm" style={{ padding: "18px 20px", marginBottom: 24, background: "var(--color-accent-2-100)", display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 18 }}>✓</span>
            <span style={{ fontSize: 14, color: "var(--color-accent-2-800)" }}>Spend recorded with evidence — syncing to the ledger.</span>
          </div>
        )}

        <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 24, margin: "0 0 20px" }}>Record a spend</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field">
            <label>Vendor name</label>
            <input className="input" type="text" placeholder="e.g. Local Bhai Logistics" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="field">
              <label>Amount</label>
              <input className="input" type="number" placeholder="₹" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="field">
              <label>Date of spend</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Category</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {CATEGORY_NAMES.map((name) => {
                const active = category === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setCategory(name)}
                    style={{
                      padding: "16px 6px",
                      borderRadius: "var(--radius-md)",
                      border: `1.5px solid ${active ? "var(--color-accent)" : "var(--color-divider)"}`,
                      background: active ? "var(--color-accent-100)" : "transparent",
                      color: active ? "var(--color-accent-800)" : "var(--color-text)",
                      fontFamily: "var(--font-body)",
                      fontWeight: 600,
                      fontSize: 13.5,
                      cursor: "pointer",
                    }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="field">
            <label>Memo (optional)</label>
            <textarea className="input" rows={2} placeholder="Notes for this spend" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>

          <div className="field">
            <label>Evidence</label>
            {evidenceAttached ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: "var(--radius-md)", background: "var(--color-surface)" }}>
                <div style={{ width: 44, height: 44, borderRadius: "var(--radius-sm)", background: "var(--color-accent-200)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                  📷
                </div>
                <span style={{ fontSize: 13.5, flex: 1 }}>Evidence photo attached</span>
                <button type="button" className="btn btn-ghost" onClick={() => setEvidenceAttached(false)}>
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEvidenceAttached(true)}
                style={{
                  width: "100%",
                  padding: 22,
                  borderRadius: "var(--radius-md)",
                  border: "1.5px dashed var(--color-divider)",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  color: "var(--color-text)",
                }}
              >
                <span style={{ fontSize: 22 }}>📷</span>
                <span style={{ fontSize: 13.5 }}>Tap to attach evidence photo</span>
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
            <span>📍</span> Location tagged: Meppadi, Wayanad district
          </div>

          {!evidenceAttached && (
            <p style={{ fontSize: 12.5, color: "var(--color-accent-800)", margin: 0 }}>Evidence required to record a spend.</p>
          )}

          <button type="button" className="btn btn-primary btn-block" disabled={!canSubmit} onClick={onSubmit}>
            Record spend
          </button>
          <button type="button" className="btn btn-ghost" style={{ alignSelf: "flex-start", fontSize: 12.5 }} onClick={onDemoReject}>
            Demo: simulate a rejected submission
          </button>
        </div>

        <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 22, margin: "48px 0 16px" }}>Recent spends</h2>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {spends.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: "1px solid var(--color-divider)" }}>
              <span className="tag tag-neutral">{s.category}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5 }}>{s.vendor}</div>
                <div style={{ fontSize: 11.5, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>{s.date}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtINR(s.amount)}</div>
                <div style={{ fontSize: 11, color: s.status === "confirmed" ? "var(--color-accent-2-700)" : "var(--color-accent-700)" }}>
                  {s.status === "confirmed" ? `Confirmed · ⧉ ${s.hash}` : "Pending sync…"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showRejectToast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--color-neutral-900)",
            color: "var(--color-neutral-100)",
            padding: "14px 20px",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            maxWidth: "min(420px,90vw)",
          }}
        >
          <span style={{ fontSize: 16 }}>⚠</span>
          <span style={{ fontSize: 13.5 }}>The contract rejected this — evidence is missing.</span>
        </div>
      )}
    </div>
  );
}
