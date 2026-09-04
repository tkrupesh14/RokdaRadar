"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo from "./Logo";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/campaigns", label: "All campaigns" },
  { href: "/arena", label: "Arena" },
  { href: "/#faq", label: "FAQ" },
];

const DONATE_HREF = "/campaign/wayanad-landslide-relief-fund";

export default function Nav() {
  const [open, setOpen] = useState(false);
  // Only turns solid once the page has actually scrolled, so the bar floats
  // transparently over the hero art at rest.
  const [scrolled, setScrolled] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A drawer that traps nothing and can't be dismissed by keyboard is a trap
  // for screen-reader and keyboard users -- close on Escape and restore focus
  // to the control that opened it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    // Stop the page scrolling behind the open drawer.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: scrolled ? "rgba(8,9,12,0.72)" : "transparent",
        borderBottom: `1px solid ${scrolled ? "var(--glass-border)" : "transparent"}`,
        backdropFilter: scrolled ? "blur(14px) saturate(1.4)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(14px) saturate(1.4)" : "none",
        transition: "background 300ms var(--ease-out), border-color 300ms var(--ease-out)",
      }}
    >
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          maxWidth: 1200,
          margin: "0 auto",
          padding: "16px clamp(20px,5vw,72px)",
        }}
      >
        <Link
          href="/"
          onClick={() => setOpen(false)}
          style={{ marginRight: "auto", display: "flex", alignItems: "center", color: "inherit" }}
        >
          <Logo />
        </Link>

        <div className="nav-desktop" style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="nav-link" style={{ color: "inherit", textDecoration: "none", fontSize: 14 }}>
              {l.label}
            </Link>
          ))}
          <Link className="btn btn-primary" href={DONATE_HREF}>
            Donate now
          </Link>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="nav-burger btn btn-secondary btn-icon"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            {open ? (
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div
          id="mobile-nav"
          ref={panelRef}
          tabIndex={-1}
          className="nav-drawer"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "8px clamp(20px,5vw,72px) 24px",
            background: "rgba(8,9,12,0.96)",
            borderBottom: "1px solid var(--glass-border)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            animation: "fadeInUp 220ms var(--ease-out) both",
          }}
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              style={{
                color: "inherit",
                textDecoration: "none",
                fontSize: 17,
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                padding: "14px 0",
                borderBottom: "1px solid var(--glass-border)",
              }}
            >
              {l.label}
            </Link>
          ))}
          <Link className="btn btn-primary btn-block" href={DONATE_HREF} onClick={() => setOpen(false)} style={{ marginTop: 14 }}>
            Donate now
          </Link>
        </div>
      )}

      <style>{`
        .nav-burger { display: none; }
        .nav-link { position: relative; transition: color 160ms var(--ease-out); }
        .nav-link::after {
          content: ""; position: absolute; left: 0; right: 100%; bottom: -4px; height: 2px;
          background: var(--gradient-accent); border-radius: 2px;
          transition: right 220ms var(--ease-out);
        }
        .nav-link:hover { color: var(--color-accent); }
        .nav-link:hover::after { right: 0; }
        @media (max-width: 860px) {
          .nav-desktop { display: none !important; }
          .nav-burger { display: inline-flex; }
        }
      `}</style>
    </header>
  );
}
