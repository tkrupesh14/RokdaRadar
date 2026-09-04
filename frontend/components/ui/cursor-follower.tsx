"use client";

// Aceternity-style cursor follower: a soft accent glow that trails the
// pointer with spring damping, plus a small precise dot that tracks it 1:1.
// The lag between the two is what makes the motion read as physical.
//
// Mounted once in the root layout. Renders nothing at all on touch devices --
// a cursor follower with no cursor is pure wasted work, and on mobile the
// listener would fire on every scroll-drag.

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

export default function CursorFollower() {
  const [enabled, setEnabled] = useState(false);
  const [pressed, setPressed] = useState(false);

  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  // Two different stiffnesses: the halo lags, the dot is near-instant.
  const haloX = useSpring(x, { stiffness: 140, damping: 18, mass: 0.6 });
  const haloY = useSpring(y, { stiffness: 140, damping: 18, mass: 0.6 });
  const dotX = useSpring(x, { stiffness: 900, damping: 34, mass: 0.25 });
  const dotY = useSpring(y, { stiffness: 900, damping: 34, mass: 0.25 });

  useEffect(() => {
    // A fine pointer plus no reduced-motion request is the only case where
    // this effect is wanted.
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;
    setEnabled(true);

    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [x, y]);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60]">
      <motion.div
        className="absolute rounded-full"
        style={{
          x: haloX,
          y: haloY,
          width: 320,
          height: 320,
          marginLeft: -160,
          marginTop: -160,
          background:
            "radial-gradient(circle, rgba(198,255,61,0.10), rgba(53,230,255,0.05) 42%, transparent 68%)",
          filter: "blur(6px)",
        }}
        animate={{ scale: pressed ? 0.82 : 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{
          x: dotX,
          y: dotY,
          width: 7,
          height: 7,
          marginLeft: -3.5,
          marginTop: -3.5,
          background: "var(--color-accent)",
          boxShadow: "0 0 14px rgba(198,255,61,0.9)",
        }}
        animate={{ scale: pressed ? 2.1 : 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      />
    </div>
  );
}
