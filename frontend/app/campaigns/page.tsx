import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { CAMPAIGNS } from "@/lib/campaigns";
import { getAggregate } from "@/lib/api";
import { fmtINR, paiseToRupees } from "@/lib/format";

export const metadata = { title: "All campaigns — RokdaRadar" };

async function loadCampaignSummaries() {
  const entries = Object.values(CAMPAIGNS);

  // Overlays real raised/spent from the backend for any entry with a
  // backendId (see lib/mergeCampaign.ts for the same pattern used on the
  // campaign detail page). Falls back to the static mock numbers if the
  // backend is unreachable or doesn't have that campaign yet.
  const overlaid = await Promise.all(
    entries.map(async (c) => {
      if (c.backendId === undefined) return { ...c, isLive: false };
      const aggregate = await getAggregate(c.backendId);
      if (!aggregate) return { ...c, isLive: false };
      return { ...c, raised: paiseToRupees(aggregate.raisedPaise), spent: paiseToRupees(aggregate.spentPaise), isLive: true };
    })
  );

  return overlaid;
}

export default async function CampaignsPage() {
  const campaigns = await loadCampaignSummaries();

  return (
    <div style={{ background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font-body)" }}>
      <Nav />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px clamp(20px,5vw,72px) 80px" }}>
        <span
          style={{
            display: "block",
            fontSize: 13,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: "var(--color-accent-700)",
            margin: "0 0 12px",
          }}
        >
          All campaigns
        </span>
        <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 400, fontSize: "clamp(30px,3.6vw,44px)", margin: "0 0 14px" }}>
          Every relief fund, one tap from proof
        </h1>
        <p
          style={{
            fontSize: 15.5,
            lineHeight: "26px",
            color: "color-mix(in srgb, var(--color-text) 78%, transparent)",
            margin: "0 0 40px",
            maxWidth: "62ch",
          }}
        >
          Pick a campaign to see its full ledger, category breakdown and AI transparency report. Campaigns marked{" "}
          <b>Live</b> are backed by real attestations on Monad testnet; others are illustrative.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18 }}>
          {campaigns.map((c, i) => {
            const left = c.raised - c.spent;
            const spentPct = c.raised > 0 ? Math.round((c.spent / c.raised) * 100) : 0;
            return (
              <Link
                key={c.slug}
                href={`/campaign/${c.slug}`}
                className="card elev-sm fade-in-up"
                style={{ padding: 18, textDecoration: "none", color: "inherit", gap: 10, animationDelay: `${Math.min(i, 8) * 60}ms` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <span className="card-kicker">{c.org}</span>
                  {c.isLive && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        padding: "3px 9px",
                        borderRadius: 999,
                        background: "var(--color-accent-2-100)",
                        color: "var(--color-accent-2-800)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ● Live
                    </span>
                  )}
                </div>
                <h3 className="card-title" style={{ fontSize: 17 }}>
                  {c.name}
                </h3>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="tag tag-outline">{c.region}</span>
                  <span className="tag tag-outline">{c.disasterTag}</span>
                </div>
                <div className="progress-track" style={{ marginTop: 4 }}>
                  <div className="progress-fill" style={{ width: `${spentPct}%` }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: 11.5, marginTop: 2 }}>
                  <div>
                    <div style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Raised</div>
                    <div style={{ fontWeight: 600 }}>{fmtINR(c.raised)}</div>
                  </div>
                  <div>
                    <div style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Spent</div>
                    <div style={{ fontWeight: 600 }}>{fmtINR(c.spent)}</div>
                  </div>
                  <div>
                    <div style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Left</div>
                    <div style={{ fontWeight: 600 }}>{fmtINR(left)}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <Footer />
    </div>
  );
}
