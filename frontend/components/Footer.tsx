import Link from "next/link";

export default function Footer() {
  return (
    <footer
      style={{
        padding: "32px clamp(20px,5vw,72px) 48px",
        fontSize: 13,
        lineHeight: "24px",
        color: "color-mix(in srgb, var(--color-text) 70%, transparent)",
        borderTop: "1px solid var(--color-divider)",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      Money moves via UPI. Only proof is recorded on Monad. No cryptocurrency changes hands.
      <br />
      ReliefTrace India — a transparency layer for disaster relief.
      <div style={{ marginTop: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link href="/operator" style={{ fontSize: 12.5 }}>
          Operator Console
        </Link>
        <Link href="/csr" style={{ fontSize: 12.5 }}>
          CSR Dashboard
        </Link>
        <Link href="/arena" style={{ fontSize: 12.5 }}>
          Arena Mode (demo)
        </Link>
      </div>
    </footer>
  );
}
