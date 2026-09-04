"use client";

// Aceternity UI "GitHub Globe", adapted to RokdaRadar.
//
// Source pattern: https://ui.aceternity.com/components/github-globe
// (three-globe + @react-three/fiber). Adapted here in three ways:
//   1. Themed to the neon-glass palette rather than Aceternity's blue.
//   2. The arcs carry meaning instead of being decorative — each one is a
//      donor city sending money to an actual Indian disaster region the
//      product covers, so the hero states the thesis rather than ornamenting.
//   3. Cursor tracking is driven by a window-level pointer listener instead
//      of OrbitControls, so the canvas keeps `pointer-events: none` and can
//      never swallow a tap meant for the donate CTA underneath it.
//
// Reached only through HeroCanvas's dynamic import, so three.js/three-globe
// stay out of the initial bundle.

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import ThreeGlobe from "three-globe";
import * as THREE from "three";
import countries from "@/data/globe.json";

const LIME = "#c6ff3d";
const CYAN = "#35e6ff";
const GLOBE_BASE = "#0b1a12";

/** Disaster regions RokdaRadar runs campaigns for. */
const REGIONS = {
  wayanad: { lat: 11.6854, lng: 76.132 },
  assam: { lat: 26.1445, lng: 91.7362 },
  odisha: { lat: 19.8135, lng: 85.8312 },
  himachal: { lat: 31.1048, lng: 77.1734 },
};

/** Domestic UPI donors + international CSR desks. */
const DONORS = [
  { lat: 19.076, lng: 72.8777 }, // Mumbai
  { lat: 28.6139, lng: 77.209 }, // Delhi
  { lat: 12.9716, lng: 77.5946 }, // Bengaluru
  { lat: 13.0827, lng: 80.2707 }, // Chennai
  { lat: 17.385, lng: 78.4867 }, // Hyderabad
  { lat: 22.5726, lng: 88.3639 }, // Kolkata
  { lat: 18.5204, lng: 73.8567 }, // Pune
  { lat: 23.0225, lng: 72.5714 }, // Ahmedabad
  { lat: 25.2048, lng: 55.2708 }, // Dubai
  { lat: 1.3521, lng: 103.8198 }, // Singapore
  { lat: 51.5074, lng: -0.1278 }, // London
  { lat: 40.7128, lng: -74.006 }, // New York
];

const REGION_LIST = Object.values(REGIONS);

type Arc = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  arcAlt: number;
  order: number;
};

function buildArcs(): Arc[] {
  return DONORS.map((donor, i) => {
    const region = REGION_LIST[i % REGION_LIST.length];
    // Longer hops need a higher arc or they clip through the sphere.
    const spread = Math.abs(donor.lng - region.lng) + Math.abs(donor.lat - region.lat);
    return {
      startLat: donor.lat,
      startLng: donor.lng,
      endLat: region.lat,
      endLng: region.lng,
      color: i % 3 === 0 ? CYAN : LIME,
      arcAlt: Math.min(0.5, 0.12 + spread / 260),
      // Staggers the dash animation so arcs fire in sequence, not in unison.
      order: i % 5,
    };
  });
}

function Globe({ quality }: { quality: "low" | "high" }) {
  const arcs = useMemo(buildArcs, []);

  const globe = useMemo(() => {
    const g = new ThreeGlobe();

    // Landmass as hex dots — the Aceternity look. Resolution 3 is the
    // legibility/perf sweet spot; 4 quadruples the dot count for detail that
    // is invisible at hero scale.
    g.hexPolygonsData((countries as { features: object[] }).features)
      .hexPolygonResolution(quality === "low" ? 2 : 3)
      .hexPolygonMargin(0.62)
      .hexPolygonAltitude(0.004)
      .hexPolygonColor(() => "rgba(198,255,61,0.92)");

    g.showAtmosphere(true).atmosphereColor(CYAN).atmosphereAltitude(0.19);

    g.arcsData(arcs)
      .arcStartLat((d) => (d as Arc).startLat)
      .arcStartLng((d) => (d as Arc).startLng)
      .arcEndLat((d) => (d as Arc).endLat)
      .arcEndLng((d) => (d as Arc).endLng)
      // arcColor is overloaded (string | string[] | accessor), which leaves
      // the callback parameter implicitly `any` -- annotate it explicitly.
      .arcColor((d: object) => (d as Arc).color)
      .arcAltitude((d) => (d as Arc).arcAlt)
      .arcStroke(0.8)
      // Long dash + small gap keeps most arcs mid-flight at any instant; the
      // original 0.4/2 ratio left the globe looking empty between passes.
      .arcDashLength(0.62)
      .arcDashGap(0.5)
      .arcDashInitialGap((d) => (d as Arc).order * 0.28)
      .arcDashAnimateTime(3200);

    // Pulsing rings over each relief zone -- the "signal received" beat that
    // makes the arcs feel like they land somewhere.
    g.ringsData(REGION_LIST)
      .ringColor(() => (t: number) => `rgba(198,255,61,${Math.max(0, 1 - t)})`)
      .ringMaxRadius(4.2)
      .ringPropagationSpeed(2.4)
      .ringRepeatPeriod(1100);

    // A dot at every endpoint so donor cities and relief zones stay visible
    // between arc passes.
    g.pointsData([...DONORS, ...REGION_LIST])
      .pointColor(() => LIME)
      .pointAltitude(0.012)
      .pointRadius(0.28)
      .pointsMerge(true);

    const material = g.globeMaterial() as THREE.MeshPhongMaterial;
    material.color = new THREE.Color(GLOBE_BASE);
    material.emissive = new THREE.Color("#0d2a1c");
    material.emissiveIntensity = 0.55;
    material.shininess = 2;

    return g;
  }, [arcs, quality]);

  // Bring India to face the camera (which sits on +Z). Two things were learned
  // the hard way here: three-globe's azimuth for a point equals its longitude
  // (so India sits 79° off the camera axis), and setting `rotation` directly on
  // the ThreeGlobe instance does not survive to render -- it comes back as 0.
  // Applying it to a group React Three Fiber owns is what actually sticks.
  const initialSpin = useMemo(() => {
    const india = globe.getCoords(22, 79, 0);
    return -Math.atan2(india.x, india.z);
  }, [globe]);

  // three-globe allocates GPU buffers for hex dots, arcs and points; React
  // unmounting the primitive does not free them on its own.
  useEffect(() => {
    return () => {
      globe.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      });
    };
  }, [globe]);

  // Slow enough that India stays in frame for the first several seconds,
  // which is when most visitors decide whether to read on.
  const spinRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (spinRef.current) spinRef.current.rotation.y += delta * 0.028;
  });

  return (
    <group ref={spinRef} rotation-y={initialSpin}>
      <primitive object={globe} />
    </group>
  );
}

/**
 * Eases the globe toward the pointer. Reads a window-level pointer position
 * (see HeroCanvas) rather than R3F's `pointer`, which only updates while the
 * cursor is over the canvas — and the canvas is pointer-events:none.
 */
function CursorRig({ children, enabled, cursor }: { children: React.ReactNode; enabled: boolean; cursor: React.RefObject<{ x: number; y: number }> }) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useEffect(() => {
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useFrame((_, delta) => {
    if (!ref.current || !enabled) return;
    const damp = 1 - Math.pow(0.0015, delta);
    const { x, y } = cursor.current;
    ref.current.rotation.y += (x * 0.34 - ref.current.rotation.y) * damp;
    ref.current.rotation.x += (-y * 0.24 - ref.current.rotation.x) * damp;
  });

  return <group ref={ref}>{children}</group>;
}

export default function GlobeScene({
  quality = "high",
  animate = true,
  cursor,
}: {
  quality?: "low" | "high";
  animate?: boolean;
  cursor: React.RefObject<{ x: number; y: number }>;
}) {
  return (
    <Canvas
      frameloop={animate ? "always" : "demand"}
      dpr={quality === "low" ? [1, 1.5] : [1, 2]}
      camera={{ position: [0, 0, 300], fov: 50, near: 180, far: 1800 }}
      gl={{ antialias: quality !== "low", alpha: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <ambientLight color={LIME} intensity={0.6} />
      <directionalLight color="#ffffff" position={[-400, 350, 400]} intensity={1.1} />
      <pointLight color={CYAN} position={[-260, 300, 360]} intensity={1.4} distance={1600} />

      <CursorRig enabled={animate} cursor={cursor}>
        <Globe quality={quality} />
      </CursorRig>
    </Canvas>
  );
}
