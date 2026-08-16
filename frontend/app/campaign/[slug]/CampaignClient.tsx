"use client";

import { useState } from "react";
import Link from "next/link";
import TxModal from "@/components/TxModal";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import { fmtINR } from "@/lib/format";
import type { CampaignDetail, LedgerRow, RelatedCampaign } from "@/lib/campaigns";

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
}: {
  campaign: CampaignDetail;
  related: RelatedCampaign[];
  aiRecord: LedgerRow;
}) {
  const [modalData, setModalData] = useState<ModalData | null>(null);

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
        <Link
          href="/"
          style={{ fontFamily: "var(--font-heading)", fontSize: 19, marginRight: "auto", textDecoration: "none", color: "var(--color-text)" }}
        >
          ReliefTrace
        </Link>
        <Link href="/#how" style={{ color: "inherit", textDecoration: "none", fontSize: 14 }}>
          How it works
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
          ← Back to ReliefTrace
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
              <div style={{ gridRow: "1/3", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                <ImagePlaceholder label="Relief camp — main photo" />
              </div>
              <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                <ImagePlaceholder label="Distribution photo" />
              </div>
              <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                <ImagePlaceholder label="Volunteer photo" />
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
              <div style={{ display: "flex", width: "100%", height: 14, borderRadius: 999, overflow: "hidden", gap: 2 }}>
                {campaign.categories.map((cat) => (
                  <div key={cat.name} style={{ flexBasis: `${cat.pct}%`, background: cat.color }} />
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px", marginTop: 14 }}>
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
                <p style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 19, margin: "0 0 10px" }}>
                  Funds are being spent as reported.
                </p>
                <p style={{ fontSize: 15, lineHeight: "27px", margin: 0, color: "color-mix(in srgb, var(--color-text) 82%, transparent)" }}>
                  Over the past 7 days, <b>₹3,42,000</b> was disbursed across food, shelter and medical supplies.
                  Every spend below carries vendor evidence and is confirmed on Monad{" "}
                  <span
                    onClick={() => openModal(aiRecord)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 13,
                      color: "var(--color-accent-2-800)",
                      background: "var(--color-accent-2-100)",
                      borderRadius: 999,
                      padding: "2px 10px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ⧉ {aiRecord.hash}
                  </span>
                  .
                </p>
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
                        <span
                          onClick={() => openModal(row)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 12.5,
                            color: "var(--color-accent-2-800)",
                            background: "var(--color-accent-2-100)",
                            borderRadius: 999,
                            padding: "2px 9px",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          ⧉ {row.hash}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Updates */}
            <section>
              <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: 26, margin: "0 0 16px" }}>Updates</h2>
              <div style={{ display: "flex", flexDirection: "column" }}>
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
              <div style={{ display: "flex", flexDirection: "column" }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                {related.map((r) => (
                  <div key={r.slug} className="card elev-sm">
                    <span className="card-kicker">{r.location}</span>
                    <h3 className="card-title">{r.name}</h3>
                    <p className="card-body">{r.blurb}</p>
                    <span className="card-meta">{fmtINR(r.raised)} raised</span>
                  </div>
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
              <svg width="88" height="88" viewBox="0 0 88 88">
                <circle cx="44" cy="44" r="37" fill="none" stroke="var(--color-neutral-200)" strokeWidth="8" />
                <circle
                  cx="44"
                  cy="44"
                  r="37"
                  fill="none"
                  stroke="var(--color-accent-2-600)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference.toFixed(1)}
                  strokeDashoffset={dashOffset.toFixed(1)}
                  transform="rotate(-90 44 44)"
                />
                <text x="44" y="50" textAnchor="middle" fontFamily="var(--font-heading)" fontSize="20" fill="var(--color-text)">
                  {campaign.trustScore}
                </text>
              </svg>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 15, color: "var(--color-accent-2-800)", marginTop: 6 }}>
                Verified
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
        ReliefTrace India — a transparency layer for disaster relief.
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
    </div>
  );
}
