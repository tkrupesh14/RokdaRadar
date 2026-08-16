"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type CardOutcome = "clean" | "flagged" | "rejected";
type ArenaCard = { agent: string; action: string; amount: number; outcome?: CardOutcome; caption?: string; stamp?: boolean };
type Step = { ticker: string; active: ArenaCard[]; settled: ArenaCard[]; meter: number; joke?: boolean };

const STEPS: Step[] = [
  { ticker: 'PM Chai-Pe-Charcha-ji inaugurates Bharatpuri Baadh Rahat 2026 — "Mitron, aaj hum blockchain pe chai pi rahe hain."', active: [], settled: [], meter: 50 },
  {
    ticker: 'Auntyji Trust Fund donates ₹5,100 — "beta shaadi ke liye bacha ke rakha tha, lo tum rakho."',
    active: [{ agent: "Auntyji Trust Fund", action: "Donation", amount: 5100 }],
    settled: [],
    meter: 55,
  },
  {
    ticker: 'Local Bhai Logistics attests delivery of food supplies — "Bhai ka kaam bolta hai."',
    active: [{ agent: "Local Bhai Logistics", action: "Spend · Food", amount: 4800 }],
    settled: [{ agent: "Auntyji Trust Fund", action: "Donation", amount: 5100, outcome: "clean", caption: "Sab thik hai, paisa seedha pahuncha." }],
    meter: 60,
  },
  {
    ticker: "BREAKING: Chindi Chor Foundation attempts a spend with zero evidence attached.",
    active: [{ agent: "Chindi Chor Foundation", action: "Spend · Shelter", amount: 22000 }],
    settled: [
      { agent: "Local Bhai Logistics", action: "Spend · Food", amount: 4800, outcome: "clean", caption: "Verified on Monad — koi shak nahi." },
      { agent: "Auntyji Trust Fund", action: "Donation", amount: 5100, outcome: "clean", caption: "Sab thik hai, paisa seedha pahuncha." },
    ],
    meter: 58,
  },
  {
    ticker: "Chindi Chor Foundation ne evidence nahi diya. Contract ne REJECT kar diya. #ReliefTrace",
    active: [],
    settled: [
      { agent: "Chindi Chor Foundation", action: "Spend · Shelter", amount: 22000, outcome: "rejected", caption: "Evidence hi nahi diya, ekdum REJECTED!", stamp: true },
      { agent: "Local Bhai Logistics", action: "Spend · Food", amount: 4800, outcome: "clean", caption: "Verified on Monad — koi shak nahi." },
    ],
    meter: 38,
  },
  {
    ticker: 'Chai-Sutta Vendor Cartel bills ₹31,200 under Shelter — memo says "generator repair."',
    active: [{ agent: "Chai-Sutta Vendor Cartel", action: "Spend · Shelter", amount: 31200 }],
    settled: [{ agent: "Chindi Chor Foundation", action: "Spend · Shelter", amount: 22000, outcome: "rejected", caption: "Evidence hi nahi diya, ekdum REJECTED!", stamp: true }],
    meter: 35,
  },
  {
    ticker: "Vigilant Aunty flags category_promise_mismatch on Chai-Sutta Vendor Cartel's spend.",
    active: [],
    settled: [
      { agent: "Chai-Sutta Vendor Cartel", action: "Spend · Shelter", amount: 31200, outcome: "flagged", caption: "Yeh vendor toh baar baar paisa le raha hai, category bhi match nahi karta — zara dekho." },
      { agent: "Chindi Chor Foundation", action: "Spend · Shelter", amount: 22000, outcome: "rejected", caption: "Evidence hi nahi diya, ekdum REJECTED!", stamp: true },
    ],
    meter: 44,
  },
  {
    ticker: 'PM Chai-Pe-Charcha-ji tweets: "ReliefTrace se transparency aayi, ab sirf chai pe hi charcha hogi."',
    active: [],
    settled: [],
    meter: 44,
    joke: true,
  },
];

const OUTCOME_COLOR: Record<CardOutcome, string> = { clean: "#1E8E5A", flagged: "#FFA400", rejected: "#FF3B3B" };
const METER_ZONES = [
  { max: 25, label: "Bhaag Gaya" },
  { max: 50, label: "Shaq Hai" },
  { max: 75, label: "Theek Thaak" },
  { max: 100, label: "Bhai Bharosemand" },
];

function fmtINR(n: number) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

export default function ArenaMode() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(playing);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (playingRef.current) setIndex((i) => (i + 1) % STEPS.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const step = STEPS[index];
  const meterZone = METER_ZONES.find((z) => step.meter <= z.max) || METER_ZONES[METER_ZONES.length - 1];

  const onNext = () => setIndex((i) => (i + 1) % STEPS.length);
  const onPrev = () => setIndex((i) => (i - 1 + STEPS.length) % STEPS.length);

  return (
    <div
      style={{
        fontFamily: "var(--arena-font-body), sans-serif",
        background: "#FFF6F9",
        color: "#1A1025",
        minHeight: "100vh",
      }}
    >
      {/* Ticker */}
      <div style={{ background: "#E6357F", color: "#fff", overflow: "hidden", display: "flex", alignItems: "center", padding: "8px 0" }}>
        <span style={{ flexShrink: 0, background: "#1A1025", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 999, margin: "0 12px", whiteSpace: "nowrap" }}>
          🎪 Fictional demo — not a real place
        </span>
        <div style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap" }}>
          <div style={{ display: "inline-block", fontFamily: "var(--arena-font-mono), monospace", fontSize: 12.5, fontWeight: 600 }}>
            {step.ticker} &nbsp;&nbsp;•&nbsp;&nbsp; {step.ticker}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 20px 80px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#1E8E5A", background: "rgba(30,142,90,0.12)", border: "1px solid rgba(30,142,90,0.3)", borderRadius: 999, padding: "4px 10px" }}>
            ✓ Verified on Monad
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#FFA400", borderRadius: 999, padding: "4px 10px" }}>Rupaiya-X ₹X</span>
        </div>
        <h1 style={{ fontFamily: "var(--arena-font-display), sans-serif", fontWeight: 800, fontSize: "clamp(30px,4vw,44px)", margin: "0 0 4px" }}>
          Bharatpuri Baadh Rahat 2026
        </h1>
        <p style={{ fontSize: 13.5, color: "#5A4A57", margin: "0 0 20px" }}>
          Sabka Saath, Sabka Ledger. Same real contract and AI pipeline as ReliefTrace — a fictional country, watching
          fraud get caught live.
        </p>

        {/* PM banner */}
        <div style={{ background: "#FFF1DA", border: "1.5px dashed #FFA400", borderRadius: 16, padding: "14px 18px", marginBottom: 24, fontStyle: "italic", fontSize: 13.5 }}>
          🍵 <b>PM Chai-Pe-Charcha-ji:</b> &quot;Mitron, aaj hum blockchain pe chai pi rahe hain.&quot;
        </div>

        {/* Sanskaari Meter */}
        <div style={{ background: "#1A1025", borderRadius: 20, padding: 24, marginBottom: 28, color: "#fff" }}>
          <div style={{ fontFamily: "var(--arena-font-display), sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Sanskaari Meter</div>
          <div style={{ display: "flex", height: 16, borderRadius: 999, overflow: "hidden", gap: 2, marginBottom: 8 }}>
            <div style={{ flex: 1, background: "#FF3B3B" }} />
            <div style={{ flex: 1, background: "#FFA400" }} />
            <div style={{ flex: 1, background: "#00C2B2" }} />
            <div style={{ flex: 1, background: "#1E8E5A" }} />
          </div>
          <div style={{ position: "relative", height: 22, marginBottom: 6 }}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: `${step.meter}%`,
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "7px solid transparent",
                borderRight: "7px solid transparent",
                borderBottom: "9px solid #fff",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 10 }}>
            <span>Bhaag Gaya</span>
            <span>Shaq Hai</span>
            <span>Theek Thaak</span>
            <span>Bhai Bharosemand</span>
          </div>
          <div style={{ fontFamily: "var(--arena-font-mono), monospace", fontSize: 18, fontWeight: 600 }}>
            {meterZone.label} · {step.meter}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button type="button" onClick={onPrev} style={{ border: "none", background: "#1A1025", color: "#fff", borderRadius: 999, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
            ◀ Prev
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            style={{ border: "none", background: "#E6357F", color: "#fff", borderRadius: 999, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <button type="button" onClick={onNext} style={{ border: "none", background: "#1A1025", color: "#fff", borderRadius: 999, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
            Next ▶
          </button>
          <span style={{ marginLeft: "auto", fontFamily: "var(--arena-font-mono), monospace", fontSize: 12, color: "#5A4A57" }}>
            Beat {index + 1} / {STEPS.length}
          </span>
        </div>

        {/* Stage */}
        {step.joke ? (
          <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 16, padding: 22, maxWidth: 460, margin: "0 auto", boxShadow: "0 4px 20px rgba(26,16,37,0.08)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#FFA400", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🍵</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  PM Chai-Pe-Charcha-ji <span style={{ color: "#1E8E5A" }}>✓</span>
                </div>
                <div style={{ fontSize: 12, color: "#5A4A57" }}>@CHARCHA_PM_official</div>
              </div>
            </div>
            <p style={{ fontSize: 14.5, lineHeight: "22px", margin: "0 0 10px" }}>
              &quot;ReliefTrace se transparency aayi, ab sirf chai pe hi charcha hogi.&quot; 🍵🎪
            </p>
            <div style={{ fontSize: 11.5, color: "#5A4A57" }}>11:47 AM · Fictional Twitter, Bharatpuri</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontFamily: "var(--arena-font-display), sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 10, color: "#5A4A57" }}>Ho Raha Hai</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {step.active.map((card, i) => (
                  <div key={i} className="arena-pulse" style={{ background: "#fff", borderRadius: 14, padding: 16, border: "2px solid #E6357F" }}>
                    <div style={{ fontFamily: "var(--arena-font-display), sans-serif", fontWeight: 700, fontSize: 14.5 }}>{card.agent}</div>
                    <div style={{ fontFamily: "var(--arena-font-mono), monospace", fontSize: 13, color: "#5A4A57", marginTop: 4 }}>
                      {card.action} · {fmtINR(card.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--arena-font-display), sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 10, color: "#5A4A57" }}>Ho Gaya</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {step.settled.map((card, i) => (
                  <div key={i} style={{ position: "relative", background: "#fff", borderRadius: 14, padding: 16, borderLeft: `5px solid ${OUTCOME_COLOR[card.outcome!]}`, overflow: "hidden" }}>
                    <div style={{ fontFamily: "var(--arena-font-display), sans-serif", fontWeight: 700, fontSize: 14.5 }}>{card.agent}</div>
                    <div style={{ fontFamily: "var(--arena-font-mono), monospace", fontSize: 13, color: "#5A4A57", marginTop: 4 }}>
                      {card.action} · {fmtINR(card.amount)}
                    </div>
                    <div style={{ fontSize: 12, fontStyle: "italic", color: OUTCOME_COLOR[card.outcome!], marginTop: 8 }}>👵 {card.caption}</div>
                    {card.stamp && (
                      <div
                        style={{
                          position: "absolute",
                          top: 14,
                          right: -30,
                          transform: "rotate(18deg)",
                          background: "rgba(255,59,59,0.08)",
                          border: "3px solid #FF3B3B",
                          color: "#FF3B3B",
                          fontFamily: "var(--arena-font-display), sans-serif",
                          fontWeight: 800,
                          fontSize: 16,
                          letterSpacing: "0.08em",
                          padding: "3px 34px",
                        }}
                      >
                        REJECTED
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 40, textAlign: "center" }}>
          <Link href="/" style={{ fontSize: 13, color: "#E6357F" }}>
            ← Back to ReliefTrace
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes arena-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(230,53,127,0.35); } 50% { box-shadow: 0 0 0 10px rgba(230,53,127,0); } }
        .arena-pulse { animation: arena-pulse 1.6s infinite; }
      `}</style>
    </div>
  );
}
