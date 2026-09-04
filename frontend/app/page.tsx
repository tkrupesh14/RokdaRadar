import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import HeroCanvas from "@/components/hero/HeroCanvas";

const FAQS = [
  {
    q: "Is this a cryptocurrency donation platform?",
    a: "No. You donate with UPI, the same way you always have. Monad only stores proof of where the money went — no wallet or crypto is ever required.",
  },
  {
    q: "How is the AI report generated?",
    a: "After a spend is recorded with vendor evidence, an AI model reads the on-chain record and writes a plain-language summary, flagging anything that looks off.",
  },
  {
    q: "What happens if evidence is missing?",
    a: "The smart contract rejects the spend before it reaches the ledger. The campaign page shows the rejection so the gap is never hidden.",
  },
  {
    q: "Can I verify a claim myself?",
    a: "Yes. Every amount and every claim links to its transaction on Monad — tap it to see the raw record.",
  },
  {
    q: "Who can start a campaign?",
    a: "Registered relief organizations verified through NGO Darpan.",
  },
];

const STATS = [
  { value: "₹9,42,000", label: "Tracked this month", tone: "lime" },
  { value: "1,204", label: "Transactions verified", tone: "cyan" },
  { value: "6", label: "Campaigns live", tone: "lime" },
  { value: "0", label: "Crypto wallets needed", tone: "cyan" },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Donate in the app you already use",
    body: "Every donation is a normal UPI payment — no wallet to set up, no crypto to buy. The chain sits underneath, recording proof, not moving money.",
  },
  {
    n: "02",
    title: "Every spend, one tap from proof",
    body: "Every rupee spent is linked to a transaction on Monad. Tap any hash link in a report or receipt and see the record for yourself.",
  },
  {
    n: "03",
    title: "An AI reads the ledger so you don't have to",
    body: "After every spend is recorded with evidence, an AI report explains where the money went in plain language, and flags anything that looks off.",
  },
];

// Fictional-but-representative ledger lines for the ticker. Static copy, not
// live data -- the live feed lives on each campaign page.
const TICKER = [
  "₹12,500 · FOOD · Wayanad",
  "0x7a3f…9e21 verified",
  "₹48,000 · SHELTER · Wayanad",
  "evidence attached",
  "₹6,200 · MEDICAL · Assam",
  "0x2f8b…c110 verified",
  "₹31,000 · WATER · Assam",
  "delivery attested",
];

export default function Home() {
  return (
    <div style={{ background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font-body)" }}>
      <Nav />

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section style={{ position: "relative", overflow: "clip" }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "clamp(28px,6vw,72px) clamp(20px,5vw,72px) clamp(40px,7vw,88px)",
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr)",
            gap: "clamp(24px,5vw,56px)",
            alignItems: "center",
          }}
          className="hero-grid"
        >
          <div style={{ minWidth: 0 }}>
            <span
              className="fade-in-up glass"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "7px 14px",
                borderRadius: 999,
                color: "var(--color-accent)",
              }}
            >
              <span
                aria-hidden="true"
                className="pulse-glow"
                style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-accent)" }}
              />
              Live on Monad testnet
            </span>

            <h1
              className="fade-in-up display-xl"
              style={{
                fontSize: "clamp(40px,7.4vw,82px)",
                margin: "22px 0 0",
                animationDelay: "60ms",
              }}
            >
              <span style={{ display: "block" }}>Where relief money</span>
              <span className="gradient-text" style={{ display: "block" }}>
                goes, and proof
              </span>
              <span style={{ display: "block" }}>it got there.</span>
            </h1>

            <p
              className="fade-in-up"
              style={{
                fontSize: "clamp(15px,1.5vw,17.5px)",
                lineHeight: 1.65,
                maxWidth: "52ch",
                margin: "26px 0 0",
                color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
                animationDelay: "120ms",
              }}
            >
              Money moves via UPI, the way it always has. Only the proof — every receipt, every rupee spent — is
              recorded on Monad. No cryptocurrency changes hands.
            </p>

            <div
              className="fade-in-up"
              style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 30, animationDelay: "180ms" }}
            >
              <Link className="btn btn-primary" href="/campaign/wayanad-landslide-relief-fund">
                Donate to a campaign
              </Link>
              <Link className="btn btn-secondary" href="#how">
                See how it works
              </Link>
            </div>
          </div>

          {/* Purely decorative: aria-hidden lives on HeroCanvas itself. */}
          <div className="hero-art" style={{ minWidth: 0, position: "relative" }}>
            <HeroCanvas />
          </div>
        </div>
      </section>

      {/* ── PROOF TICKER ───────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          borderTop: "1px solid var(--glass-border)",
          borderBottom: "1px solid var(--glass-border)",
          background: "rgba(255,255,255,0.02)",
          padding: "13px 0",
        }}
      >
        <div className="marquee">
          {/* Duplicated so the -50% translate loops seamlessly. */}
          {[0, 1].map((copy) => (
            <div className="marquee-track" key={copy}>
              {TICKER.map((item, i) => (
                <span
                  key={`${copy}-${item}`}
                  className="mono"
                  style={{
                    fontSize: 12.5,
                    whiteSpace: "nowrap",
                    color: i % 2 === 0 ? "var(--color-accent)" : "color-mix(in srgb, var(--color-text) 45%, transparent)",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 clamp(20px,5vw,72px)" }}>
        {/* ── STATS ────────────────────────────────────────────── */}
        <section id="live" style={{ padding: "clamp(48px,7vw,88px) 0 clamp(24px,4vw,40px)" }} aria-label="RokdaRadar, by the numbers">
          <div
            style={{
              display: "grid",
              // 150px min so a 390px phone still fits two per row -- at 210px
              // they collapse to a single very tall column.
              gridTemplateColumns: "repeat(auto-fit, minmax(min(150px,100%), 1fr))",
              gap: "clamp(12px,1.6vw,18px)",
            }}
          >
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className="reveal tilt-3d"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div
                  className="glass stat-orb"
                  style={{
                    borderRadius: 24,
                    padding: "clamp(20px,2.6vw,30px)",
                    minHeight: 148,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    gap: 8,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: -40,
                      right: -40,
                      width: 120,
                      height: 120,
                      borderRadius: "50%",
                      background:
                        s.tone === "lime"
                          ? "radial-gradient(circle, rgba(198,255,61,0.16), transparent 68%)"
                          : "radial-gradient(circle, rgba(53,230,255,0.16), transparent 68%)",
                    }}
                  />
                  <p
                    className="mono"
                    style={{
                      fontSize: "clamp(26px,3.4vw,38px)",
                      fontWeight: 700,
                      margin: 0,
                      lineHeight: 1,
                      color: s.tone === "lime" ? "var(--color-accent)" : "var(--color-accent-2)",
                    }}
                  >
                    {s.value}
                  </p>
                  <p
                    style={{
                      fontSize: 11.5,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      margin: 0,
                      color: "color-mix(in srgb, var(--color-text) 55%, transparent)",
                    }}
                  >
                    {s.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────── */}
        <section id="how" style={{ padding: "clamp(48px,7vw,88px) 0" }}>
          <SectionKicker>How it works</SectionKicker>
          <h2
            className="display-xl"
            style={{ fontSize: "clamp(28px,4.4vw,48px)", margin: "0 0 clamp(28px,4vw,48px)", maxWidth: "18ch" }}
          >
            Three steps, zero blind trust.
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(280px,100%), 1fr))",
              gap: "clamp(14px,2vw,22px)",
            }}
          >
            {STEPS.map((step) => (
              <div key={step.n} className="reveal tilt-3d">
                <article
                  className="glass"
                  style={{
                    borderRadius: 26,
                    padding: "clamp(22px,2.8vw,32px)",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--color-accent)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {step.n}
                  </span>
                  <h3 style={{ fontSize: "clamp(19px,2vw,22px)", margin: 0, lineHeight: 1.22 }}>{step.title}</h3>
                  <p
                    style={{
                      fontSize: 14.5,
                      lineHeight: 1.65,
                      margin: 0,
                      color: "color-mix(in srgb, var(--color-text) 68%, transparent)",
                    }}
                  >
                    {step.body}
                  </p>
                </article>
              </div>
            ))}
          </div>
        </section>

        {/* ── TRUST MODE ───────────────────────────────────────── */}
        <section
          className="trust-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr)",
            gap: "clamp(28px,4vw,64px)",
            alignItems: "center",
            padding: "clamp(24px,4vw,48px) 0 clamp(48px,7vw,88px)",
          }}
        >
          <div className="reveal">
            <SectionKicker>Trust Mode</SectionKicker>
            <h2 className="display-xl" style={{ fontSize: "clamp(26px,3.8vw,42px)", margin: 0, maxWidth: "17ch" }}>
              Every campaign, broken down by where the money went
            </h2>
            <p
              style={{
                fontSize: 15.5,
                lineHeight: 1.7,
                color: "color-mix(in srgb, var(--color-text) 68%, transparent)",
                margin: "20px 0 0",
                maxWidth: "48ch",
              }}
            >
              Each campaign page shows category spend, a live transaction feed and a trust score — built for a
              worried donor to check in thirty seconds.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 24 }}>
              <span className="tag tag-accent">Food</span>
              <span className="tag tag-accent-2">Water</span>
              <span className="tag tag-outline">Medical</span>
              <span className="tag tag-accent">Shelter</span>
              <span className="tag tag-accent-2">Logistics</span>
              <span className="tag tag-outline">Admin</span>
            </div>
            <Link className="btn btn-ghost" style={{ marginTop: 24, paddingLeft: 0 }} href="/campaigns">
              Browse all campaigns →
            </Link>
          </div>

          {/* A concrete sample of the artefact being described, rather than a
              generic screenshot placeholder. */}
          <div className="reveal tilt-3d" style={{ minWidth: 0 }}>
            <div
              className="glass"
              style={{ borderRadius: 26, padding: "clamp(20px,2.6vw,28px)", display: "flex", flexDirection: "column", gap: 18 }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 12.5, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                  Wayanad Landslide Relief
                </span>
                <span className="tag tag-accent-2" style={{ fontSize: 10 }}>
                  Trust 87
                </span>
              </div>

              {[
                { label: "Food", pct: 38, tone: "var(--gradient-accent)" },
                { label: "Shelter", pct: 27, tone: "var(--gradient-accent)" },
                { label: "Medical", pct: 21, tone: "var(--gradient-accent-2)" },
                { label: "Admin", pct: 14, tone: "var(--gradient-accent-2)" },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span>{row.label}</span>
                    <span className="mono" style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                      {row.pct}%
                    </span>
                  </div>
                  <div className="progress-track" style={{ height: 6 }}>
                    <div className="progress-fill bar-fill" style={{ width: `${row.pct}%`, background: row.tone }} />
                  </div>
                </div>
              ))}

              <div
                className="mono"
                style={{
                  fontSize: 11.5,
                  color: "var(--color-accent-2)",
                  borderTop: "1px solid var(--glass-border)",
                  paddingTop: 14,
                }}
              >
                0x7a3f…9e21 · verified on Monad
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section id="faq" style={{ padding: "clamp(24px,4vw,40px) 0 clamp(48px,7vw,88px)" }}>
          <SectionKicker>Questions</SectionKicker>
          <h2 className="display-xl" style={{ fontSize: "clamp(28px,4.4vw,48px)", margin: "0 0 clamp(20px,3vw,32px)" }}>
            Before you donate
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQS.map((item) => (
              <details
                key={item.q}
                className="faq-item glass reveal"
                style={{ borderRadius: 18, padding: "16px clamp(16px,2vw,22px)" }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: "clamp(15px,1.7vw,17px)",
                    listStyle: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    transition: "color 160ms var(--ease-out)",
                  }}
                >
                  {item.q}
                  <span aria-hidden="true" className="faq-chevron" style={{ color: "var(--color-accent)", flex: "none", fontSize: 18, lineHeight: 1 }}>
                    +
                  </span>
                </summary>
                <p
                  style={{
                    fontSize: 14.5,
                    lineHeight: 1.7,
                    margin: "14px 0 2px",
                    maxWidth: "62ch",
                    color: "color-mix(in srgb, var(--color-text) 68%, transparent)",
                  }}
                >
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── CLOSING CTA ──────────────────────────────────────── */}
        <section style={{ padding: "0 0 clamp(56px,8vw,96px)" }}>
          <div className="beam-border reveal" style={{ borderRadius: 32 }}>
            <div
              style={{
                borderRadius: 32,
                padding: "clamp(32px,5vw,64px) clamp(24px,4vw,64px)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
            >
              <h2 className="display-xl" style={{ fontSize: "clamp(26px,4vw,44px)", margin: 0, maxWidth: "18ch" }}>
                Ready to see where your money goes?
              </h2>
              <p
                style={{
                  fontSize: 15.5,
                  lineHeight: 1.7,
                  color: "color-mix(in srgb, var(--color-text) 68%, transparent)",
                  margin: 0,
                  maxWidth: "48ch",
                }}
              >
                Pick a campaign, pay with UPI, and get a receipt linked straight to the chain.
              </p>
              <Link className="btn btn-primary" style={{ marginTop: 8 }} href="/campaign/wayanad-landslide-relief-fund">
                Donate to a campaign
              </Link>
            </div>
          </div>
        </section>
      </div>

      <Footer />

      <style>{`
        /* Single-column by default (mobile-first); the hero art only earns a
           column of its own once there is room for both. */
        @media (min-width: 900px) {
          .hero-grid { grid-template-columns: minmax(0,1.05fr) minmax(0,0.95fr) !important; }
          .trust-grid { grid-template-columns: minmax(0,6fr) minmax(0,5fr) !important; }
        }
        /* Below that the orb would push the CTA off-screen, so cap it hard. */
        @media (max-width: 899px) {
          .hero-art { max-width: 460px; width: 100%; margin: 0 auto; order: -1; }
        }
        @media (max-width: 560px) {
          .hero-art { max-width: 330px; }
        }
        .faq-item summary::-webkit-details-marker { display: none; }
        .faq-item[open] .faq-chevron { transform: rotate(45deg); }
        .faq-chevron { transition: transform 220ms var(--ease-out); display: inline-block; }
        .faq-item:hover { border-color: var(--glass-border-bright); }
        .faq-item summary:hover { color: var(--color-accent); }
      `}</style>
    </div>
  );
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 12,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        fontWeight: 600,
        color: "var(--color-accent)",
        margin: "0 0 18px",
      }}
    >
      <span aria-hidden="true" style={{ width: 24, height: 1, background: "var(--color-accent)", opacity: 0.6 }} />
      {children}
    </span>
  );
}
