import type { CSSProperties } from "react";

export default function ImagePlaceholder({
  label,
  style,
}: {
  label: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 12,
        background:
          "repeating-linear-gradient(135deg, var(--color-accent-100), var(--color-accent-100) 12px, var(--color-neutral-200) 12px, var(--color-neutral-200) 24px)",
        filter: "saturate(0.6) contrast(0.85) brightness(1.1) opacity(0.94)",
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
          background: "var(--color-bg)",
          padding: "4px 10px",
          borderRadius: 999,
        }}
      >
        {label}
      </span>
    </div>
  );
}
