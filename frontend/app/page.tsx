import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ImagePlaceholder from "@/components/ImagePlaceholder";

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

export default function Home() {
  return (
    <div style={{ background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font-body)" }}>
      <Nav />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 clamp(20px,5vw,72px)" }}>
        {/* Hero */}
        <section style={{ position: "relative", padding: "96px 0 64px" }}>
          <div
            style={{
              position: "absolute",
              right: -180,
              top: -200,
              width: 420,
              height: 420,
              borderRadius: "50%",
              background: "var(--color-accent-2-200)",
              zIndex: -1,
            }}
          />
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 400,
              fontSize: "clamp(38px,5.6vw,68px)",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            <span style={{ display: "block" }}>Where relief money goes,</span>
            <span style={{ display: "block" }}>and proof it got there.</span>
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: "28px",
              maxWidth: "54ch",
              margin: "26px 0 0",
              color: "color-mix(in srgb, var(--color-text) 82%, transparent)",
            }}
          >
            Money moves via UPI, the way it always has. Only the proof — every receipt, every rupee spent — is
            recorded on Monad. No cryptocurrency changes hands.
          </p>
          <div style={{ display: "flex", gap: 13, flexWrap: "wrap", marginTop: 26 }}>
            <Link className="btn btn-primary" href="/campaign/wayanad-landslide-relief-fund">
              Donate to a campaign
            </Link>
            <Link className="btn btn-ghost" href="#how">
              See how it works
            </Link>
          </div>
        </section>

        {/* Stats bed */}
        <section
          style={{ position: "relative", padding: "8px 0 48px", minHeight: 360 }}
          aria-label="RokdaRadar, by the numbers"
        >
          <div
            style={{
              position: "absolute",
              borderRadius: "50%",
              width: 220,
              aspectRatio: "1",
              left: 0,
              top: 36,
              background: "var(--color-accent-100)",
              display: "grid",
              placeContent: "center",
              textAlign: "center",
              padding: 24,
            }}
          >
            <p style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 40, margin: 0, color: "var(--color-accent-700)" }}>
              ₹9,42,000
            </p>
            <p
              style={{
                fontSize: 12,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 600,
                margin: "8px 0 0",
                color: "color-mix(in srgb, var(--color-text) 70%, transparent)",
              }}
            >
              Tracked this month
            </p>
          </div>
          <div
            style={{
              position: "absolute",
              borderRadius: "50%",
              width: 170,
              aspectRatio: "1",
              left: 190,
              top: 200,
              background: "var(--color-accent-200)",
              display: "grid",
              placeContent: "center",
              textAlign: "center",
              padding: 20,
            }}
          >
            <p style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 32, margin: 0, color: "var(--color-accent-700)" }}>6</p>
            <p
              style={{
                fontSize: 12,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 600,
                margin: "8px 0 0",
                color: "color-mix(in srgb, var(--color-text) 70%, transparent)",
              }}
            >
              Campaigns live
            </p>
          </div>
          <div
            style={{
              position: "absolute",
              borderRadius: "50%",
              width: 280,
              aspectRatio: "1",
              right: 60,
              top: -40,
              background: "var(--color-accent-2-300)",
              display: "grid",
              placeContent: "center",
              textAlign: "center",
              padding: 28,
            }}
          >
            <p style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 40, margin: 0, color: "var(--color-accent-2-800)" }}>
              1,204
            </p>
            <p
              style={{
                fontSize: 12,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 600,
                margin: "8px 0 0",
                color: "color-mix(in srgb, var(--color-text) 70%, transparent)",
              }}
            >
              Transactions verified
            </p>
          </div>
          <div
            style={{
              position: "absolute",
              borderRadius: "50%",
              width: 160,
              aspectRatio: "1",
              right: 280,
              top: 170,
              background: "var(--color-accent-2-100)",
              display: "grid",
              placeContent: "center",
              textAlign: "center",
              padding: 18,
            }}
          >
            <p style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 30, margin: 0, color: "var(--color-accent-2-700)" }}>0</p>
            <p
              style={{
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 600,
                margin: "8px 0 0",
                color: "color-mix(in srgb, var(--color-text) 70%, transparent)",
              }}
            >
              Crypto wallets needed
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how" style={{ padding: "80px 0 64px" }}>
          <span
            style={{
              display: "block",
              fontSize: 13,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 600,
              color: "var(--color-accent-700)",
              margin: "0 0 30px",
            }}
          >
            How it works
          </span>

          {[
            {
              title: "Donate in the app you already use",
              body: "Every donation is a normal UPI payment — no wallet to set up, no crypto to buy. The chain sits underneath, recording proof, not moving money.",
            },
            {
              title: "Every spend, one tap from proof",
              body: "Every rupee spent is linked to a transaction on Monad. Tap any hash link in a report or receipt and see the record for yourself.",
            },
            {
              title: "An AI reads the ledger so you don't have to",
              body: "After every spend is recorded with evidence, an AI report explains where the money went in plain language, and flags anything that looks off.",
            },
          ].map((step, i, arr) => (
            <div
              key={step.title}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,420px) minmax(0,1fr)",
                gap: "28px 56px",
                alignItems: "baseline",
                padding: "22px 0",
                borderTop: "1px solid var(--color-divider)",
                borderBottom: i === arr.length - 1 ? "1px solid var(--color-divider)" : undefined,
              }}
            >
              <h2
                style={{
                  position: "relative",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 400,
                  fontSize: 24,
                  margin: 0,
                  paddingLeft: 30,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 6,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "var(--color-accent)",
                    display: "inline-block",
                  }}
                />
                {step.title}
              </h2>
              <p
                style={{
                  fontSize: 15.5,
                  lineHeight: "28px",
                  margin: 0,
                  maxWidth: "56ch",
                  color: "color-mix(in srgb, var(--color-text) 78%, transparent)",
                }}
              >
                {step.body}
              </p>
            </div>
          ))}
        </section>

        {/* Trust Mode / categories split */}
        <section
          id="live"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,7fr) minmax(0,5fr)",
            gap: "28px clamp(24px,5vw,80px)",
            alignItems: "center",
            padding: "56px 0 80px",
          }}
        >
          <div>
            <span
              style={{
                display: "block",
                fontSize: 13,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 600,
                color: "var(--color-accent-700)",
                margin: "0 0 14px",
              }}
            >
              Trust Mode
            </span>
            <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 30, lineHeight: 1.25, margin: 0 }}>
              Every campaign, broken down by where the money went
            </h2>
            <p
              style={{
                fontSize: 15.5,
                lineHeight: "28px",
                color: "color-mix(in srgb, var(--color-text) 78%, transparent)",
                margin: "20px 0 0",
                maxWidth: "48ch",
              }}
            >
              Each campaign page shows category spend, a live transaction feed and a trust score — built for a
              worried donor to check in thirty seconds.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 22 }}>
              <span className="tag tag-accent">Food</span>
              <span className="tag tag-accent-2">Water</span>
              <span className="tag tag-outline">Medical</span>
              <span className="tag tag-accent">Shelter</span>
              <span className="tag tag-accent-2">Logistics</span>
              <span className="tag tag-outline">Admin</span>
            </div>
            <Link className="btn btn-ghost" style={{ marginTop: 22, paddingLeft: 0 }} href="/campaigns">
              Browse all campaigns →
            </Link>
          </div>
          <figure
            style={{
              margin: 0,
              width: "min(400px,100%)",
              justifySelf: "end",
              borderRadius: "calc(2 * var(--radius-lg))",
              overflow: "hidden",
              aspectRatio: "9/16",
            }}
          >
            <ImagePlaceholder label="Campaign page screenshot" />
          </figure>
        </section>

        {/* FAQ */}
        <section id="faq" style={{ padding: "56px 0 80px" }}>
          <span
            style={{
              display: "block",
              fontSize: 13,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 600,
              color: "var(--color-accent-700)",
              margin: "0 0 14px",
            }}
          >
            Questions
          </span>
          <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 30, margin: "0 0 24px" }}>
            Before you donate
          </h2>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {FAQS.map((item) => (
              <details key={item.q} style={{ padding: "18px 0", borderTop: "1px solid var(--color-divider)" }}>
                <summary style={{ cursor: "pointer", fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 17 }}>
                  {item.q}
                </summary>
                <p
                  style={{
                    fontSize: 14.5,
                    lineHeight: "26px",
                    margin: "12px 0 0",
                    maxWidth: "60ch",
                    color: "color-mix(in srgb, var(--color-text) 78%, transparent)",
                  }}
                >
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Close patch */}
        <section style={{ padding: "0 0 56px" }}>
          <div
            style={{
              background: "var(--color-accent-2-100)",
              borderRadius: "calc(2 * var(--radius-lg))",
              padding: "48px clamp(24px,4vw,64px)",
            }}
          >
            <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 26, margin: 0 }}>
              Ready to see where your money goes?
            </h3>
            <p
              style={{
                fontSize: 15.5,
                lineHeight: "28px",
                color: "color-mix(in srgb, var(--color-text) 78%, transparent)",
                margin: "14px 0 0",
                maxWidth: "56ch",
              }}
            >
              Pick a campaign, pay with UPI, and get a receipt linked straight to the chain.
            </p>
            <Link className="btn btn-primary" style={{ marginTop: 22 }} href="/campaign/wayanad-landslide-relief-fund">
              Donate to a campaign
            </Link>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
