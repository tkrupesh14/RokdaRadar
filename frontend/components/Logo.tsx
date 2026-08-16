export default function Logo({ height = 28 }: { height?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 32" height={height} role="img" aria-label="RokdaRadar">
      {/* Icon Mark -- same radar mark as app/icon.svg, themed to the warm
          "Organic" palette (var()s so it stays in sync with globals.css). */}
      <g transform="translate(4, 0)">
        <circle cx="16" cy="16" r="15" style={{ fill: "var(--color-accent-800)", stroke: "var(--color-accent-400)" }} strokeWidth="2" />
        <circle cx="16" cy="16" r="10" fill="none" style={{ stroke: "var(--color-accent-600)" }} strokeWidth="1.5" />
        <circle cx="16" cy="16" r="5" fill="none" style={{ stroke: "var(--color-accent-600)" }} strokeWidth="1.5" />
        <path d="M16 16 L24 8 A11.3 11.3 0 0 1 26 16 Z" style={{ fill: "var(--color-accent-300)" }} opacity="0.55" />
        <circle cx="21" cy="11" r="2.5" style={{ fill: "var(--color-accent-2-500)" }} />
      </g>
      {/* Text Label -- "Rokda" inherits the surrounding text color (light or
          dark header alike); "Radar" always takes the theme's accent color. */}
      <text
        x="44"
        y="21"
        style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}
        fontSize="16"
        fontWeight="400"
        fill="currentColor"
      >
        Rokda<tspan style={{ fill: "var(--color-accent)" }}>Radar</tspan>
      </text>
    </svg>
  );
}
