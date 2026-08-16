import Link from "next/link";
import Logo from "./Logo";

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
      <Link href="/" style={{ marginRight: "auto", display: "flex", alignItems: "center", color: "inherit" }}>
        <Logo />
      </Link>
      <Link href="/#how" style={{ color: "inherit", textDecoration: "none", fontSize: 14 }}>
        How it works
      </Link>
      <Link href="/campaigns" style={{ color: "inherit", textDecoration: "none", fontSize: 14 }}>
        All campaigns
      </Link>
      <Link href="/arena" style={{ color: "inherit", textDecoration: "none", fontSize: 14 }}>
        Arena
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
