import Link from "next/link";

export default function Nav() {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        padding: "22px clamp(20px,5vw,72px)",
      }}
    >
      <Link
        href="/"
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 19,
          marginRight: "auto",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        ReliefTrace
      </Link>
      <Link href="/#how" style={{ color: "inherit", textDecoration: "none", fontSize: 14 }}>
        How it works
      </Link>
      <Link href="/#live" style={{ color: "inherit", textDecoration: "none", fontSize: 14 }}>
        Live now
      </Link>
      <Link href="/#faq" style={{ color: "inherit", textDecoration: "none", fontSize: 14 }}>
        FAQ
      </Link>
      <Link className="btn btn-primary" href="/campaign/wayanad-landslide-relief-fund">
        Donate now
      </Link>
    </nav>
  );
}
