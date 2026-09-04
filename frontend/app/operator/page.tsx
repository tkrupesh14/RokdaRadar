"use client";

import { useEffect, useState } from "react";
import { getFeed, recordSpend } from "@/lib/api";
import { paiseToRupees, shortHash, explorerTxUrl } from "@/lib/format";
import { connectWallet, getAuthorizedAccount, onAccountsChanged, signOperatorRequest } from "@/lib/wallet";
import { useNetworkStatus } from "@/lib/network";
import { useLiveLocation } from "@/lib/geolocation";
import Logo from "@/components/Logo";
import EvidenceCapture from "@/components/EvidenceCapture";

const CATEGORY_NAMES = ["Food", "Water", "Medical", "Shelter", "Logistics", "Admin"];

// Backend campaignIds -- see lib/campaigns.ts / lib/csrData.ts backendId.
// The contract's campaignCount starts at 0, so the first campaign ever
// created is id 0, not 1.
const CAMPAIGN_BACKEND_IDS: Record<string, number> = { wayanad: 0, assam: 1, odisha: 2 };
const SPEND_ROUTE = "POST /api/campaigns/:id/spend";

type Spend = {
  id: number;
  vendor: string;
  category: string;
  amount: number;
  date: string;
  status: "confirmed" | "pending" | "failed";
  hash?: string;
  explorerUrl?: string;
  error?: string;
};

const INITIAL_SPENDS: Spend[] = [
  { id: 1, vendor: "Local Bhai Logistics", category: "Food", amount: 18400, date: "Aug 14", status: "confirmed", hash: "0x7a3f...9e21" },
  { id: 2, vendor: "Kerala Tarp Co.", category: "Shelter", amount: 26000, date: "Aug 12", status: "confirmed", hash: "0x2f8b...c110" },
  { id: 3, vendor: "Wayanad Medical Store", category: "Medical", amount: 9800, date: "Aug 10", status: "confirmed", hash: "0x66e0...ab77" },
];

function fmtINR(n: number) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

export default function OperatorConsole() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState("wayanad");
  const network = useNetworkStatus();
  const location = useLiveLocation(loggedIn);

  // Skip the login screen if the wallet is already authorized for this site
  // (a prior "Connect wallet" grant persists across reloads in MetaMask), and
  // log out automatically if the operator disconnects or switches accounts
  // to one that hasn't granted access.
  useEffect(() => {
    let cancelled = false;
    getAuthorizedAccount().then((addr) => {
      if (cancelled || !addr) return;
      setAddress(addr);
      setLoggedIn(true);
    });
    const unsubscribe = onAccountsChanged((accounts) => {
      const addr = accounts[0] ?? null;
      setAddress(addr);
      setLoggedIn(!!addr);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("2026-08-15");
  const [category, setCategory] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const [spends, setSpends] = useState<Spend[]>(INITIAL_SPENDS);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Overlays real confirmed spends from the backend feed for campaigns that
  // have a real on-chain campaignId (currently just wayanad). Falls back to
  // (and merges alongside) the local demo list otherwise.
  useEffect(() => {
    const backendId = CAMPAIGN_BACKEND_IDS[campaign];
    // Explicit undefined check: campaignId 0 (wayanad) is valid and falsy.
    if (backendId === undefined) return;

    let cancelled = false;
    getFeed(backendId, 10).then((feed) => {
      if (cancelled || !feed) return;
      const realSpends: Spend[] = feed.items
        .filter((item): item is Extract<typeof item, { type: "spend" }> => item.type === "spend")
        .map((item) => ({
          id: -1 * new Date(item.ts * 1000).getTime(), // negative to never collide with Date.now() ids from local demo submissions
          vendor: item.memo || "On-chain spend",
          category: item.category.charAt(0) + item.category.slice(1).toLowerCase(),
          amount: paiseToRupees(item.amountPaise),
          date: new Date(item.ts * 1000).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
          status: "confirmed",
          hash: shortHash(item.txHash),
          explorerUrl: explorerTxUrl(item.txHash),
        }));
      if (realSpends.length > 0) {
        setSpends((prev) => [...realSpends, ...prev.filter((s) => s.id > 0)]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [campaign]);

  const canSubmit = !!(vendor && Number(amount) > 0 && category && evidenceFile && address && !submitting);

  const onConnectWallet = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const addr = await connectWallet();
      setAddress(addr);
      setLoggedIn(true);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Could not connect wallet.");
    } finally {
      setConnecting(false);
    }
  };

  const onLogout = () => {
    setLoggedIn(false);
    setAddress(null);
  };

  const onSubmit = async () => {
    if (!canSubmit || !category || !evidenceFile || !address) return;
    const backendId = CAMPAIGN_BACKEND_IDS[campaign];
    const amountPaise = Math.round(Number(amount) * 100);
    const recordId = Date.now();

    setSubmitting(true);
    setSpends((s) => [{ id: recordId, vendor, category, amount: Number(amount), date, status: "pending" }, ...s]);
    setJustSubmitted(recordId);

    const submittedVendor = vendor;
    setVendor("");
    setAmount("");
    setCategory(null);
    setMemo("");
    setEvidenceFile(null);

    try {
      if (backendId === undefined) {
        throw new Error("This demo campaign has no on-chain id yet — spend recording is unavailable for it.");
      }
      const auth = await signOperatorRequest(address, SPEND_ROUTE, backendId);
      const result = await recordSpend(
        backendId,
        { vendorRef: submittedVendor, amountPaise, category: category.toUpperCase(), memo, evidenceFile },
        auth
      );
      if (result.ok) {
        setSpends((s) =>
          s.map((sp) =>
            sp.id === recordId
              ? { ...sp, status: "confirmed", hash: shortHash(result.data.txHash), explorerUrl: result.data.explorerUrl }
              : sp
          )
        );
      } else {
        setSpends((s) => s.map((sp) => (sp.id === recordId ? { ...sp, status: "failed", error: result.error } : sp)));
        setToast(result.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign or submit the request.";
      setSpends((s) => s.map((sp) => (sp.id === recordId ? { ...sp, status: "failed", error: message } : sp)));
      setToast(message);
    } finally {
      setSubmitting(false);
      setTimeout(() => setJustSubmitted(null), 4000);
      setTimeout(() => setToast(null), 5000);
    }
  };

  if (!loggedIn) {
    return (
      <div style={{ fontFamily: "var(--font-body)", minHeight: "100vh", background: "var(--color-bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div className="card elev-lg fade-in-up" style={{ width: "100%", maxWidth: 360, padding: 32 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, color: "var(--color-accent-700)", marginBottom: 6 }}>
            RokdaRadar — internal access
          </div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 24, margin: "0 0 22px" }}>Operator Console</h1>
          <p style={{ fontSize: 13, lineHeight: "19px", color: "color-mix(in srgb, var(--color-text) 65%, transparent)", margin: "0 0 20px" }}>
            Connect the operator wallet used to sign spends and delivery attestations for this campaign.
          </p>
          <button type="button" className="btn btn-primary btn-block" disabled={connecting} onClick={onConnectWallet}>
            {connecting ? "Connecting…" : "Connect wallet"}
          </button>
          {connectError && (
            <p style={{ fontSize: 12.5, color: "var(--color-danger-700)", margin: "12px 0 0" }}>{connectError}</p>
          )}
          <p style={{ fontSize: 12, lineHeight: "19px", color: "color-mix(in srgb, var(--color-text) 60%, transparent)", margin: "16px 0 0" }}>
            Access is limited to verified relief operators. Donors and the public use the campaign page instead.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "var(--font-body)", minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "16px clamp(16px,4vw,40px)", background: "rgba(255,255,255,0.04)", color: "var(--color-text)", borderBottom: "1px solid var(--glass-border)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Logo height={22} />
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 17 }}>Operator</span>
        </span>
        <select
          className="op-select input"
          style={{ width: "auto", maxWidth: 220, background: "rgba(255,255,255,0.06)", color: "var(--color-text)", borderColor: "var(--glass-border-bright)" }}
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
        >
          <option value="wayanad">Wayanad Landslide Relief Fund</option>
          <option value="assam">Assam Flood Relief 2026</option>
          <option value="odisha">Odisha Cyclone Rebuild Fund</option>
        </select>
        <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
          {network === "online" && "🟢 Online"}
          {network === "poor" && "📶 Poor connection — will sync later"}
          {network === "offline" && "📴 Offline — will sync later"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="mono" style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{address ? shortHash(address) : ""}</span>
          <button type="button" className="btn btn-secondary" style={{ background: "transparent", borderColor: "var(--glass-border-bright)", color: "var(--color-text)" }} onClick={onLogout}>
            Disconnect
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 96px" }}>
        {justSubmitted !== null && (
          <div className="card elev-sm banner-in" style={{ padding: "18px 20px", marginBottom: 24, background: "var(--color-accent-2-100)", display: "flex", gap: 10, alignItems: "center" }}>
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
              <label>Amount (₹)</label>
              <input className="input" type="number" placeholder="₹" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="field">
              <label>Date of spend</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Category</label>
            <div className="op-category-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
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
                      transition: "border-color 160ms var(--ease-out), background 160ms var(--ease-out), color 160ms var(--ease-out), transform 120ms var(--ease-out)",
                      transform: active ? "scale(1.03)" : "scale(1)",
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
            <EvidenceCapture value={evidenceFile} onChange={setEvidenceFile} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
            <span>📍</span>
            {location.status === "idle" || location.status === "locating" ? (
              <span>Locating…</span>
            ) : location.status === "error" ? (
              <span>{location.error ?? "Location unavailable"}</span>
            ) : (
              <span>
                Location tagged: {location.label ?? `${location.coords!.lat.toFixed(5)}, ${location.coords!.lng.toFixed(5)}`}
                {location.coords && ` (±${Math.round(location.coords.accuracy)}m)`}
              </span>
            )}
          </div>

          {!evidenceFile && (
            <p style={{ fontSize: 12.5, color: "var(--color-danger-700)", margin: 0 }}>Evidence required to record a spend.</p>
          )}

          <button type="button" className="btn btn-primary btn-block" disabled={!canSubmit} onClick={onSubmit}>
            {submitting ? "Signing & submitting…" : "Record spend"}
          </button>
        </div>

        <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 22, margin: "48px 0 16px" }}>Recent spends</h2>
        <div className="stagger-list" style={{ display: "flex", flexDirection: "column" }}>
          {spends.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: "1px solid var(--color-divider)" }}>
              <span className="tag tag-neutral">{s.category}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5 }}>{s.vendor}</div>
                <div style={{ fontSize: 11.5, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>{s.date}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtINR(s.amount)}</div>
                {s.status === "confirmed" && (
                  <div style={{ fontSize: 11, color: "var(--color-accent-2-700)" }}>
                    Confirmed ·{" "}
                    {s.explorerUrl ? (
                      <a href={s.explorerUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                        ⧉ {s.hash}
                      </a>
                    ) : (
                      <>⧉ {s.hash}</>
                    )}
                  </div>
                )}
                {s.status === "pending" && <div style={{ fontSize: 11, color: "var(--color-accent-700)" }}>Pending sync…</div>}
                {s.status === "failed" && (
                  <div style={{ fontSize: 11, color: "var(--color-danger-700, #b42318)" }} title={s.error}>
                    Rejected
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <div
          className="toast-in"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            background: "#12151c",
            color: "var(--color-text)",
            border: "1px solid var(--glass-border-bright)",
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
          <span style={{ fontSize: 13.5 }}>{toast}</span>
        </div>
      )}
    </div>
  );
}
