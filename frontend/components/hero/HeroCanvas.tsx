"use client";

// Loader + guard around the WebGL hero.
//
// three.js is ~600KB, so it must never be part of what a donor downloads
// before they can read the page. This component renders a pure-CSS orb
// immediately, then swaps in the real scene only once the browser is idle
// AND the hero is actually on screen AND the device can plausibly run it.
// If any of those fail, the CSS orb simply stays -- it is a finished visual
// in its own right, not a spinner.

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const ProofOrbScene = dynamic(() => import("./ProofOrbScene"), {
  ssr: false,
  loading: () => null,
});

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

/** The always-rendered fallback: concentric glowing rings + a soft core. */
function CssOrb({ dimmed }: { dimmed: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        opacity: dimmed ? 0 : 1,
        transition: "opacity 900ms var(--ease-out)",
      }}
    >
      <div
        className="float-y"
        style={{
          width: "min(74%, 380px)",
          aspectRatio: "1",
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 38% 32%, rgba(198,255,61,0.55), rgba(53,230,255,0.22) 42%, transparent 68%)",
          filter: "blur(6px)",
        }}
      />
      {[0.62, 0.82, 1].map((scale, i) => (
        <div
          key={scale}
          style={{
            position: "absolute",
            width: `min(${74 * scale}%, ${380 * scale}px)`,
            aspectRatio: "1",
            borderRadius: "50%",
            border: `1px solid ${i === 1 ? "rgba(53,230,255,0.3)" : "rgba(198,255,61,0.28)"}`,
            transform: `rotate(${i * 24}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default function HeroCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<{ show: boolean; quality: "low" | "high"; animate: boolean }>({
    show: false,
    quality: "high",
    animate: true,
  });
  const [sceneVisible, setSceneVisible] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !supportsWebGL()) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Coarse pointer or few cores => phone-class hardware. Render the same
    // scene with fewer nodes rather than dropping to the CSS fallback, so
    // mobile still gets the 3D the design is built around.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const weak = (navigator.hardwareConcurrency ?? 8) <= 4;
    const quality: "low" | "high" = coarse || weak ? "low" : "high";

    // Safari only shipped requestIdleCallback recently, so fall back to a
    // short timeout. Captured up front to keep the cleanup symmetric.
    const idle = typeof window.requestIdleCallback === "function";
    let idleHandle: number | undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        // Wait for idle so the 3D download never competes with the content
        // paint or with hydration.
        const start = () => setScene({ show: true, quality, animate: !reduceMotion });
        idleHandle = idle ? window.requestIdleCallback(start, { timeout: 2200 }) : window.setTimeout(start, 380);
      },
      { rootMargin: "160px" }
    );
    observer.observe(host);

    return () => {
      observer.disconnect();
      if (idleHandle === undefined) return;
      if (idle) window.cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
    };
  }, []);

  // Cross-fade: hold the CSS orb until the canvas has had a moment to draw
  // its first frame, so the swap never flashes an empty box.
  useEffect(() => {
    if (!scene.show) return;
    const t = setTimeout(() => setSceneVisible(true), 220);
    return () => clearTimeout(t);
  }, [scene.show]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1",
        maxHeight: "min(78vh, 620px)",
        margin: "0 auto",
        // Pointer events off: the hero art must never swallow taps meant for
        // the CTA sitting beside/over it on small screens.
        pointerEvents: "none",
      }}
    >
      <CssOrb dimmed={sceneVisible} />
      {scene.show && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: sceneVisible ? 1 : 0,
            transition: "opacity 900ms var(--ease-out)",
          }}
        >
          <ProofOrbScene quality={scene.quality} animate={scene.animate} />
        </div>
      )}
    </div>
  );
}
