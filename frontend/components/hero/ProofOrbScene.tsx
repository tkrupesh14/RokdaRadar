"use client";

// The WebGL centrepiece for the homepage hero.
//
// Concept: a wireframe globe (the public ledger) wrapped in an orbiting
// shell of glowing nodes (individual attested transactions), with a bright
// core inside it (the money itself). It reads as "value, held inside
// something transparent that anyone can see through" -- which is the whole
// product thesis, so the hero isn't just decoration.
//
// This module is only ever reached through HeroCanvas's dynamic import, so
// three.js stays out of the initial bundle. Everything here assumes it is
// running client-side with an existing WebGL context.

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const LIME = "#c6ff3d";
const CYAN = "#35e6ff";

/** Even-ish distribution of points on a sphere via the golden-angle spiral. */
function sphericalPoints(count: number, radius: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    // Jitter the shell so the nodes read as a cloud rather than a lattice.
    const r = radius * (0.94 + Math.random() * 0.12);
    positions[i * 3] = Math.cos(theta) * ringRadius * r;
    positions[i * 3 + 1] = y * r;
    positions[i * 3 + 2] = Math.sin(theta) * ringRadius * r;
  }
  return positions;
}

function TransactionCloud({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => sphericalPoints(count, 2.55), [count]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.075;
    ref.current.rotation.x += delta * 0.022;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      {/* Additive blending fakes bloom without pulling in a postprocessing
          pass -- overlapping nodes bloom into each other for free. */}
      <pointsMaterial
        size={0.038}
        color={CYAN}
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function LedgerShell() {
  const ref = useRef<THREE.LineSegments>(null);
  // detail=2 keeps the wireframe readable; higher subdivisions turn to mush
  // at hero scale and cost fill rate for nothing.
  const geometry = useMemo(() => new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2, 2)), []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y -= delta * 0.11;
  });

  return (
    <lineSegments ref={ref} geometry={geometry}>
      <lineBasicMaterial color={LIME} transparent opacity={0.32} blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  );
}

function ValueCore() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.34;
    ref.current.rotation.z += delta * 0.13;
    // Slow "breathing" so the core feels alive rather than static geometry.
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.1) * 0.045;
    ref.current.scale.setScalar(pulse);
  });

  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.02, 0]} />
      <meshStandardMaterial
        color={LIME}
        emissive={LIME}
        emissiveIntensity={1.5}
        roughness={0.25}
        metalness={0.65}
        flatShading
      />
    </mesh>
  );
}

function OrbitRing({ tilt, radius, speed, color }: { tilt: [number, number, number]; radius: number; speed: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.z += delta * speed;
  });

  return (
    <mesh ref={ref} rotation={tilt}>
      <torusGeometry args={[radius, 0.008, 8, 128]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

/**
 * Eases the whole rig toward the pointer. Parallax is applied to a parent
 * group rather than the camera so the composition stays framed the same way
 * at every viewport size.
 */
function ParallaxRig({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  useFrame((_, delta) => {
    if (!ref.current || !enabled) return;
    // Frame-rate independent damping: converge ~8%/16ms toward the target.
    const damp = 1 - Math.pow(0.001, delta);
    ref.current.rotation.y += (pointer.x * 0.32 - ref.current.rotation.y) * damp;
    ref.current.rotation.x += (-pointer.y * 0.22 - ref.current.rotation.x) * damp;
  });

  return <group ref={ref}>{children}</group>;
}

export default function ProofOrbScene({
  quality = "high",
  animate = true,
}: {
  /** "low" trims node count and pixel ratio for phones / weak GPUs. */
  quality?: "low" | "high";
  /** False when the visitor asked for reduced motion: render one static frame. */
  animate?: boolean;
}) {
  const isLow = quality === "low";

  return (
    <Canvas
      // A static frame still communicates the concept, so reduced-motion
      // visitors get the geometry without any movement at all.
      frameloop={animate ? "always" : "demand"}
      dpr={isLow ? [1, 1.5] : [1, 2]}
      camera={{ position: [0, 0, 6.4], fov: 45 }}
      gl={{ antialias: !isLow, alpha: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 4, 5]} intensity={55} color={LIME} distance={18} />
      <pointLight position={[-5, -2, 3]} intensity={40} color={CYAN} distance={18} />

      <ParallaxRig enabled={animate}>
        <ValueCore />
        <LedgerShell />
        <TransactionCloud count={isLow ? 420 : 900} />
        <OrbitRing tilt={[1.42, 0.3, 0]} radius={3.05} speed={0.16} color={LIME} />
        <OrbitRing tilt={[1.05, -0.5, 0.6]} radius={3.45} speed={-0.1} color={CYAN} />
      </ParallaxRig>
    </Canvas>
  );
}
