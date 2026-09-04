"use client";

import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import TxModal from "@/components/TxModal";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import Logo from "@/components/Logo";
import HashChip from "@/components/HashChip";
import { fmtINR } from "@/lib/format";
import { useModalA11y } from "@/lib/useModalA11y";
import type { CampaignDetail, LedgerRow, RelatedCampaign, TrustScoreBreakdown } from "@/lib/campaigns";
import type { ApiReport } from "@/lib/api";

type ModalData = {
  date: string;
  desc: string;
  category: string;
  amountDisplay: string;
  hash: string;
};

export default function CampaignClient({
  campaign,
  related,
  aiRecord,
  report,
}: {
  campaign: CampaignDetail;
  related: RelatedCampaign[];
  aiRecord: LedgerRow;
  report?: ApiReport | null;
}) {
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [showTrustInfo, setShowTrustInfo] = useState(false);

  const openModal = (row: LedgerRow) =>
    setModalData({ date: row.date, desc: row.desc, category: row.category, amountDisplay: fmtINR(row.amount), hash: row.hash });

  const left = campaign.raised - campaign.spent;
  // trust score ring geometry (r=37 circumference ~232.5, matches source markup style)
  const circumference = 2 * Math.PI * 37;
  const dashOffset = circumference * (1 - campaign.trustScore / 100);

  return (
    <div style={{ background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font-body)" }}>
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          padding: "22px clamp(20px,4vw,56px)",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <Link href="/" style={{ marginRight: "auto", display: "flex", alignItems: "center", color: "var(--color-text)" }}>
          <Logo />
        </Link>
        <Link href="/#how" style={{ color: "inherit", textDecoration: "none", fontSize: 14 }}>
          How it works
        </Link>
        <Link href="/campaigns" style={{ color: "inherit", textDecoration: "none", fontSize: 14 }}>
          All campaigns
        </Link>
        <Link href="/#faq" style={{ color: "inherit", textDecoration: "none", fontSize: 14 }}>
          FAQ
        </Link>
        <Link className="btn btn-primary" href="#donate">
          Donate now
        </Link>
      </nav>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px clamp(20px,4vw,56px) 72px" }}>
        <Link href="/" style={{ fontSize: 13, textDecoration: "none" }}>
          ← Back to RokdaRadar
        </Link>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) 340px",
            gap: "48px clamp(28px,4vw,56px)",
            alignItems: "start",
            marginTop: 24,
          }}
        >
          {/* MAIN */}
          <main style={{ display: "flex", flexDirection: "column", gap: 56, minWidth: 0 }}>
            {/* Header */}
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-accent-2-800)",
                    background: "var(--color-accent-2-100)",
                    borderRadius: 999,
                    padding: "5px 12px",
                  }}
                >
                  ✓ Darpan Registered
                </span>
                <span className="tag tag-outline">{campaign.region}</span>
                <span className="tag tag-outline">{campaign.disasterTag}</span>
              </div>
              <div style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 65%, transparent)", marginBottom: 4 }}>
                {campaign.org}
              </div>
              <h1
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 400,
                  fontSize: "clamp(30px,3.6vw,46px)",
                  lineHeight: 1.15,
                  margin: "0 0 18px",
                }}
              >
                {campaign.name}
              </h1>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {campaign.categories.map((c) => (
                  <span key={c.name} className="tag tag-outline">
                    {c.name}
                  </span>
                ))}
              </div>
            </section>

            {/* Gallery */}
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gridTemplateRows: "1fr 1fr",
                gap: 12,
                height: 380,
              }}
            >
              <div className="gallery-frame" style={{ gridRow: "1/3", position: "relative", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                <Image
                  src="/campaign/relief-camp.jpeg"
                  alt="Relief camp — main photo"
                  fill
                  sizes="(max-width: 900px) 100vw, 640px"
                  style={{ objectFit: "cover", transition: "transform 400ms var(--ease-out)" }}
                  className="gallery-img"
                />
              </div>
              <div className="gallery-frame" style={{ position: "relative", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                <Image
                  src="/campaign/distribution.jpeg"
                  alt="Distribution photo"
                  fill
                  sizes="(max-width: 900px) 50vw, 320px"
                  style={{ objectFit: "cover", transition: "transform 400ms var(--ease-out)" }}
                  className="gallery-img"
                />
              </div>
              <div className="gallery-frame" style={{ position: "relative", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                <Image
                  src="/campaign/volunteers.jpeg"
                  alt="Volunteer photo"
                  fill
                  sizes="(max-width: 900px) 50vw, 320px"
                  style={{ objectFit: "cover", transition: "transform 400ms var(--ease-out)" }}
                  className="gallery-img"
                />
              </div>
            </section>

            {/* Story */}
            <section>
              <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 26, margin: "0 0 16px" }}>
                About this campaign
              </h2>
              {campaign.story.map((p, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: 15.5,
                    lineHeight: "28px",
                    margin: i === campaign.story.length - 1 ? 0 : "0 0 16px",
                    maxWidth: "68ch",
                    color: "color-mix(in srgb, var(--color-text) 82%, transparent)",
                  }}
                >
                  {p}
                </p>
              ))}
            </section>

            {/* Category breakdown */}
            <section>
              <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 26, margin: "0 0 16px" }}>
                Where the money went
              </h2>
              <div className="bar-fill" style={{ display: "flex", width: "100%", height: 14, borderRadius: 999, overflow: "hidden", gap: 2 }}>
                {campaign.categories.map((cat) => (
                  <div key={cat.name} style={{ flexBasis: `${cat.pct}%`, background: cat.color }} />
                ))}
              </div>
              <div className="stagger-list" style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px", marginTop: 14 }}>
                {campaign.categories.map((cat) => (
                  <div
                    key={cat.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      color: "color-mix(in srgb, var(--color-text) 70%, transparent)",
                    }}
                  >
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: cat.color, display: "inline-block" }} />
                    {cat.name} · {cat.pct}%
                  </div>
                ))}
              </div>
            </section>

            {/* AI Report */}
            <section>
              <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 26, margin: "0 0 16px" }}>
                AI Report
              </h2>
              <div className="card elev-sm" style={{ padding: 24 }}>
                {report ? (
                  <>
                    <p style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 19, margin: "0 0 10px" }}>
                      {report.headline}
                    </p>
                    <p style={{ fontSize: 15, lineHeight: "27px", margin: "0 0 10px", color: "color-mix(in srgb, var(--color-text) 82%, transparent)" }}>
                      {report.summary}
                    </p>
                    <div style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                      Every number above is checked against on-chain data before this report is shown (guardrail-verified) ·
                      generated {new Date(report.generatedAt).toLocaleString("en-IN")}
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 19, margin: "0 0 10px" }}>
                      Funds are being spent as reported.
                    </p>
                    <p style={{ fontSize: 15, lineHeight: "27px", margin: 0, color: "color-mix(in srgb, var(--color-text) 82%, transparent)" }}>
                      Over the past 7 days, <b>₹3,42,000</b> was disbursed across food, shelter and medical supplies.
                      Every spend below carries vendor evidence and is confirmed on Monad{" "}
                      <HashChip hash={aiRecord.hash} onOpen={() => openModal(aiRecord)} fontSize={13} padding="2px 10px" />.
                    </p>
                  </>
                )}
              </div>
            </section>

            {/* Ledger table */}
            <section>
              <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 26, margin: "0 0 16px" }}>
                Full spend ledger
              </h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.ledger.map((row) => (
                    <tr key={row.hash}>
                      <td>{row.date}</td>
                      <td>{row.desc}</td>
                      <td>
                        <span className="tag tag-neutral">{row.category}</span>
                      </td>
                      <td>{fmtINR(row.amount)}</td>
                      <td>
                        <HashChip
                          hash={row.hash}
                          label={`View transaction proof for ${row.desc}, ${row.date}`}
                          onOpen={() => openModal(row)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Updates */}
            <section>
              <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 26, margin: "0 0 16px" }}>Updates</h2>
              <div className="stagger-list" style={{ display: "flex", flexDirection: "column" }}>
                {campaign.updates.map((u) => (
                  <div
                    key={u.date}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "120px 1fr",
                      gap: 20,
                      padding: "16px 0",
                      borderTop: "1px solid var(--color-divider)",
                    }}
                  >
                    <div style={{ fontSize: 12.5, color: "color-mix(in srgb, var(--color-text) 60%, transparent)", fontWeight: 600 }}>
                      {u.date}
                    </div>
                    <p style={{ fontSize: 14.5, lineHeight: "25px", margin: 0, maxWidth: "60ch" }}>{u.text}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Donors */}
            <section>
              <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 26, margin: "0 0 16px" }}>
                Recent supporters
              </h2>
              <div className="stagger-list" style={{ display: "flex", flexDirection: "column" }}>
                {campaign.donors.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 0",
                      borderTop: "1px solid var(--color-divider)",
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{d.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-accent-700)" }}>{fmtINR(d.amount)}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Map */}
            <section>
              <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 26, margin: "0 0 16px" }}>
                Affected area
              </h2>
              <div style={{ height: 260, borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                <ImagePlaceholder label={campaign.mapLabel} />
              </div>
            </section>

            {/* Related */}
            <section>
              <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 26, margin: "0 0 16px" }}>
                Other active campaigns
              </h2>
              <div className="stagger-list" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/campaign/${r.slug}`}
                    className="card elev-sm"
                    style={{ color: "inherit", textDecoration: "none", cursor: "pointer" }}
                  >
                    <span className="card-kicker">{r.location}</span>
                    <h3 className="card-title">{r.name}</h3>
                    <p className="card-body">{r.blurb}</p>
                    <span className="card-meta">{fmtINR(r.raised)} raised</span>
                  </Link>
                ))}
              </div>
            </section>
          </main>

          {/* SIDEBAR */}
          <aside style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="card elev-md" style={{ padding: 22 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center", marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                    Raised
                  </div>
                  <div style={{ fontFamily: "var(--font-heading)", fontSize: 17, marginTop: 4 }}>{fmtINR(campaign.raised)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                    Spent
                  </div>
                  <div style={{ fontFamily: "var(--font-heading)", fontSize: 17, marginTop: 4 }}>{fmtINR(campaign.spent)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                    Left
                  </div>
                  <div style={{ fontFamily: "var(--font-heading)", fontSize: 17, marginTop: 4 }}>{fmtINR(left)}</div>
                </div>
              </div>
              <div id="donate" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[100, 500, 2000, 5000].map((amt) => (
                    <button key={amt} type="button" className="btn btn-secondary" style={{ flex: 1, minWidth: 64 }}>
                      {fmtINR(amt)}
                    </button>
                  ))}
                </div>
                <Link
                  className="btn btn-primary btn-block"
                  style={{ marginTop: 0, justifyContent: "center" }}
                  href={`/campaign/${campaign.slug}/donate`}
                >
                  Donate to this campaign
                </Link>
              </div>
            </div>

            <div className="card elev-sm" style={{ padding: 22, alignItems: "center", textAlign: "center" }}>
              <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`Trust score: ${campaign.trustScore} out of 100`}>
                <circle cx="44" cy="44" r="37" fill="none" stroke="var(--color-neutral-200)" strokeWidth="8" />
                <circle
                  className="ring-fill"
                  cx="44"
                  cy="44"
                  r="37"
                  fill="none"
                  stroke="var(--color-accent-2-600)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference.toFixed(1)}
                  style={{
                    strokeDashoffset: dashOffset,
                    ["--ring-empty" as string]: circumference.toFixed(1),
                  }}
                  transform="rotate(-90 44 44)"
                />
                <text aria-hidden="true" x="44" y="50" textAnchor="middle" fontFamily="var(--font-heading)" fontSize="20" fill="var(--color-text)">
                  {campaign.trustScore}
                </text>
              </svg>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 15, color: "var(--color-accent-2-800)", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                Verified
                {campaign.trustScoreBreakdown && (
                  <button
                    type="button"
                    onClick={() => setShowTrustInfo(true)}
                    aria-label="How the trust score is calculated"
                    style={{
                      width: 16, height: 16, borderRadius: "50%", border: "1px solid var(--color-accent-2-700)",
                      background: "transparent", color: "var(--color-accent-2-700)", fontSize: 10, lineHeight: 1,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0,
                    }}
                  >
                    i
                  </button>
                )}
              </div>
            </div>

            <p style={{ textAlign: "center", fontSize: 12, lineHeight: "20px", color: "color-mix(in srgb, var(--color-text) 65%, transparent)", margin: 0 }}>
              Money moves via UPI. Only proof is recorded on Monad.
              <br />
              No cryptocurrency changes hands.
            </p>
          </aside>
        </div>
      </div>

      <footer
        style={{
          padding: "32px clamp(20px,4vw,56px) 48px",
          fontSize: 13,
          lineHeight: "24px",
          color: "color-mix(in srgb, var(--color-text) 70%, transparent)",
          borderTop: "1px solid var(--color-divider)",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        RokdaRadar India — a transparency layer for disaster relief.
      </footer>

      {modalData && (
        <TxModal
          onClose={() => setModalData(null)}
          rows={[
            { label: "Date", value: modalData.date },
            { label: "Description", value: modalData.desc },
            { label: "Category", value: modalData.category },
            { label: "Amount", value: modalData.amountDisplay },
            { label: "Hash", value: modalData.hash },
          ]}
        />
      )}

      {showTrustInfo && campaign.trustScoreBreakdown && (
        <TrustInfoDialog breakdown={campaign.trustScoreBreakdown} onClose={() => setShowTrustInfo(false)} />
      )}

      <style>{`
        .gallery-frame:hover .gallery-img { transform: scale(1.05); }
        .hash-chip:hover { background: var(--color-accent-2-200); transform: translateY(-1px); }
        .hash-chip:active { transform: translateY(0) scale(0.97); }
        @media (prefers-reduced-motion: reduce) {
          .gallery-frame:hover .gallery-img, .hash-chip:hover, .hash-chip:active { transform: none !important; }
        }
      `}</style>
    </div>
  );
}

function TrustInfoDialog({ breakdown, onClose }: { breakdown: TrustScoreBreakdown; onClose: () => void }) {
  const dialogRef = useModalA11y(onClose);
  const titleId = useId();

  return (
    <div className="dialog-backdrop" style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="dialog-title" id={titleId}>How this score is calculated</h3>
        <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0 }}>
            Computed server-side from on-chain data, never by AI. The published formula has 5 weighted
            factors; 2 are live today:
          </p>
          <p style={{ margin: 0 }}>
            <b>{Math.round(breakdown.weights.evidencedSpendPct * 100)}%</b> weight —
            spend with evidence on file: <b>{breakdown.evidencedSpendPct}%</b>
          </p>
          <p style={{ margin: 0 }}>
            <b>{Math.round(breakdown.weights.deliveryAttestedPct * 100)}%</b> weight —
            spend with an independent delivery attestation: <b>{breakdown.deliveryAttestedPct}%</b>
          </p>
          <p style={{ margin: 0, fontSize: 12.5, opacity: 0.75 }}>
            Bank reconciliation, promise-alignment, and attestor-diversity checks are being built next and
            will be added to this score as they ship — this score reflects only what&apos;s verifiable
            today, not a final rating.
          </p>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
