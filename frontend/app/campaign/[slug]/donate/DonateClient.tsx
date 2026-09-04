"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import TxModal from "@/components/TxModal";
import Logo from "@/components/Logo";
import HashChip from "@/components/HashChip";
import { donateToCampaign } from "@/lib/api";
import { explorerTxUrl, fmtINR, shortHash } from "@/lib/format";
import type { CampaignDetail } from "@/lib/campaigns";

const CHIP_AMOUNTS = [100, 500, 2000, 5000];

type Beat = "amount" | "payment" | "receipt";

export default function DonateClient({ campaign }: { campaign: CampaignDetail }) {
  const customAmountId = useId();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [beat, setBeat] = useState<Beat>("amount");
  const [isPaying, setIsPaying] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const amount = selectedAmount || Number(customAmount) || 0;
  const amountDisplay = fmtINR(amount);

  // Each beat replaces the page's main content with no navigation and no
  // URL change, so nothing tells a screen-reader or keyboard user that new
  // content appeared -- move focus to the new step's heading, the same way
  // a page navigation would land focus at the top of a new page.
  const paymentHeadingRef = useRef<HTMLHeadingElement>(null);
  const receiptHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (beat === "payment") paymentHeadingRef.current?.focus();
    if (beat === "receipt") receiptHeadingRef.current?.focus();
  }, [beat]);

  const pickChip = (amt: number) => {
    setSelectedAmount(amt);
    setCustomAmount("");
  };

  const onContinue = () => {
    if (amount > 0) setBeat("payment");
  };

  const onPay = async () => {
    if (campaign.backendId === undefined) {
      setPayError("This campaign doesn't have a live on-chain campaign yet, so it can't record a real donation.");
      return;
    }
    setIsPaying(true);
    setPayError(null);
    const amountPaise = Math.round(amount * 100);
    const result = await donateToCampaign(campaign.backendId, amountPaise);
    setIsPaying(false);
    if (!result.ok) {
      setPayError(result.error);
      return;
    }
    setTxHash(result.data.txHash);
    setBeat("receipt");
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
                  className="chip-btn"
                  onClick={() => pickChip(amt)}
                  aria-pressed={active}
                  style={{
                    padding: "10px 4px",
                    borderRadius: 999,
                    border: `1px solid ${active ? "var(--color-accent)" : "var(--color-divider)"}`,
                    background: active ? "var(--gradient-accent)" : "transparent",
                    color: active ? "var(--color-bg)" : "var(--color-text)",
                    fontFamily: "var(--font-heading)",
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "background 160ms var(--ease-out), border-color 160ms var(--ease-out), transform 120ms var(--ease-out), box-shadow 160ms var(--ease-out)",
                    transform: active ? "translateY(-1px)" : "none",
                    boxShadow: active ? "var(--shadow-sm)" : "none",
                  }}
                >
                  {fmtINR(amt)}
                </button>
              );
            })}
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor={customAmountId}>Or enter an amount</label>
            <input
              id={customAmountId}
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
          <section className="beat-enter" style={{ borderTop: "1px solid var(--color-divider)", paddingTop: 32 }}>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <h2
                ref={paymentHeadingRef}
                tabIndex={-1}
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: "color-mix(in srgb, var(--color-text) 65%, transparent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 6,
                }}
              >
                Paying
              </h2>
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
              <div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 14 }}>
                <span
                  aria-hidden="true"
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
                  Confirming on Monad…
                </span>
              </div>
            )}
            {beat === "payment" && !isPaying && (
              <>
                {payError && (
                  <p style={{ fontSize: 13, color: "var(--color-accent-800)", margin: "0 0 12px", textAlign: "center" }}>
                    {payError}
                  </p>
                )}
                <button type="button" className="btn btn-primary btn-block" onClick={onPay}>
                  I&rsquo;ve completed the payment
                </button>
              </>
            )}
          </section>
        )}

        {/* BEAT 3: receipt */}
        {beat === "receipt" && (
          <section className="beat-enter" style={{ borderTop: "1px solid var(--color-divider)", paddingTop: 32, textAlign: "center" }}>
            <h2 ref={receiptHeadingRef} tabIndex={-1} className="sr-only">
              Donation complete
            </h2>
            <div
              className="pop-scale"
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
            <div className="fade-in-up" style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 32, marginBottom: 6, animationDelay: "80ms" }}>{amountDisplay}</div>
            <div className="fade-in-up" style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 65%, transparent)", marginBottom: 18, animationDelay: "130ms" }}>
              Confirmed on Monad
            </div>
            {txHash && (
              <div className="fade-in-up" style={{ display: "flex", justifyContent: "center", marginBottom: 24, animationDelay: "180ms" }}>
                <HashChip
                  hash={shortHash(txHash)}
                  label={`View transaction proof, ${amountDisplay}`}
                  onOpen={() => setModalOpen(true)}
                  fontSize={13}
                  padding="5px 12px"
                />
              </div>
            )}
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

      {modalOpen && txHash && (
        <TxModal
          onClose={() => setModalOpen(false)}
          explorerUrl={explorerTxUrl(txHash)}
          rows={[
            { label: "Amount", value: amountDisplay },
            { label: "Hash", value: shortHash(txHash) },
            { label: "Donor", value: "You" },
            { label: "Campaign", value: campaign.name },
          ]}
        />
      )}

      <style>{`
        .chip-btn:not(:disabled):hover { border-color: var(--color-accent); }
        .chip-btn:not(:disabled):active { transform: scale(0.96) !important; }
        .hash-chip:hover { background: var(--color-accent-2-200); transform: translateY(-1px); }
        .hash-chip:active { transform: translateY(0) scale(0.97); }
        .beat-enter { animation: popin 180ms ease-out; }
        .sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .beat-enter { animation: none !important; }
          .chip-btn:not(:disabled):active, .hash-chip:hover, .hash-chip:active { transform: none !important; }
        }
      `}</style>
    </div>
  );
}
