"use client";

// Aceternity UI "Card Spotlight" pattern, themed for RokdaRadar.
// Source pattern: https://ui.aceternity.com/components/card-spotlight
//
// A radial highlight tracks the cursor across the card and fades out when the
// pointer leaves. Implemented with motion values + useMotionTemplate so the
// gradient updates on the compositor without re-rendering React on every
// mousemove.

import { useState, type MouseEvent, type ReactNode, type CSSProperties } from "react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { cn } from "@/lib/utils";

export default function SpotlightCard({
  children,
  className,
  style,
  radius = 340,
  /** Set false for surfaces that should stay calm (money / proof screens). */
  glow = true,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  radius?: number;
  glow?: boolean;
}) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [hovered, setHovered] = useState(false);

  function onMouseMove({ currentTarget, clientX, clientY }: MouseEvent<HTMLDivElement>) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const background = useMotionTemplate`radial-gradient(${radius}px circle at ${mouseX}px ${mouseY}px, rgba(198,255,61,0.14), rgba(53,230,255,0.06) 40%, transparent 70%)`;
  // A second, tighter gradient painted onto the border via mask, so the edge
  // lights up where the cursor is rather than glowing uniformly.
  const borderLight = useMotionTemplate`radial-gradient(${radius * 0.7}px circle at ${mouseX}px ${mouseY}px, rgba(198,255,61,0.55), transparent 65%)`;

  return (
    <div
      onMouseMove={onMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn("group relative overflow-hidden", className)}
      style={style}
    >
      {glow && (
        <>
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-opacity duration-300"
            style={{ background, opacity: hovered ? 1 : 0, borderRadius: "inherit" }}
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-opacity duration-300"
            style={{
              opacity: hovered ? 1 : 0,
              borderRadius: "inherit",
              padding: 1,
              background: borderLight,
              // Punch out the centre so only the 1px ring paints.
              WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />
        </>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
