"use client";

// A `<span onClick>` looks and works fine with a mouse but is invisible to
// keyboard and screen-reader users -- it can't receive focus and has no
// button semantics, so "open the transaction proof" silently doesn't exist
// for them. This is the same clickable hash affordance used in three places
// across the campaign/donate pages; fixing it once here fixes all three.
export default function HashChip({
  hash,
  label,
  onOpen,
  fontSize = 12.5,
  padding = "2px 9px",
}: {
  hash: string;
  label?: string;
  onOpen: () => void;
  fontSize?: number;
  padding?: string;
}) {
  return (
    <button
      type="button"
      className="hash-chip"
      onClick={onOpen}
      aria-label={label ?? `View transaction proof for ${hash}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize,
        color: "var(--color-accent-2-800)",
        background: "var(--color-accent-2-100)",
        border: "none",
        borderRadius: 999,
        padding,
        cursor: "pointer",
        whiteSpace: "nowrap",
        font: "inherit",
        fontFamily: "inherit",
        transition: "background 160ms var(--ease-out), transform 160ms var(--ease-out)",
      }}
    >
      ⧉ {hash}
    </button>
  );
}
