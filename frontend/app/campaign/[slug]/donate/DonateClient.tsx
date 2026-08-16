"use client";

import { useState } from "react";
import Link from "next/link";
import TxModal from "@/components/TxModal";
import Logo from "@/components/Logo";
import { fmtINR } from "@/lib/format";
import type { CampaignDetail } from "@/lib/campaigns";

const CHIP_AMOUNTS = [100, 500, 2000, 5000];
const TX_HASH = "0x9f21...c084";

type Beat = "amount" | "payment" | "receipt";

export default function DonateClient({ campaign }: { campaign: CampaignDetail }) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [beat, setBeat] = useState<Beat>("amount");
  const [isPaying, setIsPaying] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const amount = selectedAmount || Number(customAmount) || 0;
  const amountDisplay = fmtINR(amount);

  const pickChip = (amt: number) => {
    setSelectedAmount(amt);
    setCustomAmount("");
  };

  const onContinue = () => {
    if (amount > 0) setBeat("payment");
  };

  const onPay = () => {
    setIsPaying(true);
    setTimeout(() => {
      setIsPaying(false);
      setBeat("receipt");
    }, 900);
  };

  return (
    <div style={{ background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font-body)", minHeight: "100vh" }}>
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "22px clamp(20px,4vw,56px)",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <Link
          href={`/campaign/${campaign.slug}`}
          style={{ marginRight: "auto", display: "flex", alignItems: "center", color: "var(--color-text)" }}
        >
          <Logo />
        </Link>
        <Link href={`/campaign/${campaign.slug}`} style={{ fontSize: 13, textDecoration: "none" }}>
          ← Back to campaign
        </Link>
      </nav>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px 96px", display: "flex", flexDirection: "column", gap: 36 }}>
        <div>
          <div style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 65%, transparent)", marginBottom: 4 }}>
            {campaign.org}
          </div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 26, margin: 0 }}>{campaign.name}</h1>
        </div>

        {/* BEAT 1: amount */}
        <section>
          <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 20, margin: "0 0 16px" }}>
            Choose an amount
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {CHIP_AMOUNTS.map((amt) => {
              const active = selectedAmount === amt;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => pickChip(amt)}
                  style={{
                    padding: "10px 4px",
                    borderRadius: 999,
                    border: `1px solid ${active ? "var(--color-accent)" : "var(--color-divider)"}`,
                    background: active ? "var(--color-accent)" : "transparent",
                    color: active ? "var(--color-bg)" : "var(--color-text)",
                    fontFamily: "var(--font-heading)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {fmtINR(amt)}
                </button>
              );
            })}
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Or enter an amount</label>
            <input
              className="input"
              type="number"
              min={1}
              placeholder="₹"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedAmount(null);
              }}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={amount <= 0}
            onClick={onContinue}
            style={{ marginTop: 18 }}
          >
            Continue
          </button>
        </section>

        {/* BEAT 2: UPI payment */}
        {beat !== "amount" && (
          <section style={{ animation: "popin 180ms ease-out", borderTop: "1px solid var(--color-divider)", paddingTop: 32 }}>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "color-mix(in srgb, var(--color-text) 65%, transparent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 6,
                }}
              >
                Paying
              </div>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 38 }}>{amountDisplay}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <div
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: "var(--radius-lg)",
                  background:
                    "repeating-linear-gradient(45deg, var(--color-neutral-200), var(--color-neutral-200) 8px, var(--color-neutral-100) 8px, var(--color-neutral-100) 16px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, background: "var(--color-bg)", padding: "4px 10px", borderRadius: 999 }}>
                  scan to pay · QR
                </span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 22 }}>
              <span className="tag tag-outline">UPI app 1</span>
              <span className="tag tag-outline">UPI app 2</span>
              <span className="tag tag-outline">Other UPI ID</span>
            </div>
            {beat === "payment" && isPaying && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 14 }}>
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: "2.5px solid var(--color-divider)",
                    borderTopColor: "var(--color-accent)",
                    display: "inline-block",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 75%, transparent)" }}>
                  Waiting for confirmation…
                </span>
              </div>
            )}
            {beat === "payment" && !isPaying && (
              <button type="button" className="btn btn-primary btn-block" onClick={onPay}>
                I&rsquo;ve completed the payment
              </button>
            )}
          </section>
        )}

        {/* BEAT 3: receipt */}
        {beat === "receipt" && (
          <section style={{ animation: "popin 180ms ease-out", borderTop: "1px solid var(--color-divider)", paddingTop: 32, textAlign: "center" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--color-accent-2-100)",
                color: "var(--color-accent-2-800)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                margin: "0 auto 18px",
              }}
            >
              ✓
            </div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 32, marginBottom: 6 }}>{amountDisplay}</div>
            <div style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 65%, transparent)", marginBottom: 18 }}>
              Confirmed in under a second
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <span
                onClick={() => setModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 13,
                  color: "var(--color-accent-2-800)",
                  background: "var(--color-accent-2-100)",
                  borderRadius: 999,
                  padding: "5px 12px",
                  cursor: "pointer",
                }}
              >
                ⧉ {TX_HASH}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 320, margin: "0 auto" }}>
              <button type="button" className="btn btn-secondary btn-block">
                Download 80G receipt
              </button>
              <Link className="btn btn-ghost" href={`/campaign/${campaign.slug}`} style={{ justifyContent: "center" }}>
                Back to campaign
              </Link>
            </div>
          </section>
        )}
      </div>

      {modalOpen && (
        <TxModal
          onClose={() => setModalOpen(false)}
          rows={[
            { label: "Amount", value: amountDisplay },
            { label: "Hash", value: TX_HASH },
            { label: "Donor", value: "You" },
            { label: "Campaign", value: campaign.name },
          ]}
        />
      )}
    </div>
  );
}
