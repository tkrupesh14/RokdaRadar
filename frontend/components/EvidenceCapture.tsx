"use client";

import { useEffect, useRef, useState } from "react";
import { isMobileDevice } from "@/lib/device";

const EVIDENCE_ACCEPT = "image/jpeg,image/png,application/pdf";

type DesktopPhase = "idle" | "starting" | "live" | "error";

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera detected. Connect a phone as a USB camera, or a webcam, to upload evidence.";
  }
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access was denied. Allow camera access in your browser to record evidence.";
  }
  return "Could not access a camera. Connect a phone or webcam and try again.";
}

// Evidence can only come from a live camera capture, never a file/gallery
// picker (LLD's evidence chain-of-custody intent: the photo must be taken at
// the point of spend, not sourced from an existing image). On a phone this
// is a native <input capture> camera app; on desktop it's a real
// getUserMedia() live preview against whatever camera device is actually
// attached (built-in webcam, or a phone running in USB-webcam mode) -- there
// is no web API to detect "a phone is plugged in" more specifically than
// that, so "no camera device available" is the honest trigger for the error
// state below.
export default function EvidenceCapture({
  value,
  onChange,
}: {
  value: File | null;
  onChange: (file: File | null) => void;
}) {
  const [mobile, setMobile] = useState<boolean | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [phase, setPhase] = useState<DesktopPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // isMobileDevice() reads navigator, which isn't available during SSR;
    // deferring the read to an effect (rather than a lazy useState
    // initializer) avoids a server/client hydration mismatch, at the cost of
    // one extra client-only render -- the intentional exception to the rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobile(isMobileDevice());
  }, []);

  useEffect(() => {
    // Deriving previewUrl from `value` needs to be an effect, not a render
    // computation, because URL.createObjectURL allocates a resource that
    // must be revoked in this effect's cleanup when `value` changes/unmounts.
    if (!value || !value.type.startsWith("image/")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => stopStream, []);

  const openCamera = async () => {
    setError(null);
    setPhase("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setPhase("live");
    } catch (err) {
      setError(cameraErrorMessage(err));
      setPhase("error");
    }
  };

  // The <video> element only exists in the DOM once `phase` becomes "live"
  // (it's conditionally rendered below), so it can't be assigned a stream
  // synchronously inside openCamera() -- that ref is still null at that
  // point, which was the black-screen bug: the element mounted on the next
  // render but never actually got wired to the stream. Doing it here, keyed
  // on the ref callback firing, guarantees the element exists first.
  const attachVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onChange(new File([blob], `evidence-${Date.now()}.jpg`, { type: "image/jpeg" }));
        stopStream();
        setPhase("idle");
      },
      "image/jpeg",
      0.9
    );
  };

  const cancelCamera = () => {
    stopStream();
    setPhase("idle");
  };

  const remove = () => {
    stopStream();
    setPhase("idle");
    setError(null);
    onChange(null);
  };

  if (mobile === null) return null; // avoid a server/client render mismatch on first paint

  if (value) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: "var(--radius-md)", background: "var(--color-surface)" }}>
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- transient object URL for a freshly-captured/picked file, not worth Next/Image's optimizer.
          <img src={previewUrl} alt="Evidence preview" style={{ width: 44, height: 44, borderRadius: "var(--radius-sm)", objectFit: "cover" }} />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: "var(--radius-sm)", background: "var(--color-accent-200)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
            📄
          </div>
        )}
        <span style={{ fontSize: 13.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value.name}</span>
        <button type="button" className="btn btn-ghost" onClick={remove}>
          Remove
        </button>
      </div>
    );
  }

  if (mobile) {
    return (
      <label
        style={{
          width: "100%",
          padding: 22,
          borderRadius: "var(--radius-md)",
          border: "1.5px dashed var(--color-divider)",
          background: "transparent",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          color: "var(--color-text)",
        }}
      >
        <span style={{ fontSize: 22 }}>📷</span>
        <span style={{ fontSize: 13.5 }}>Tap to open camera</span>
        <input
          type="file"
          accept={EVIDENCE_ACCEPT}
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
    );
  }

  // Desktop: live getUserMedia preview, no file-picker fallback.
  if (phase === "live") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <video
          ref={attachVideoRef}
          autoPlay
          muted
          playsInline
          style={{ width: "100%", borderRadius: "var(--radius-md)", background: "#000", maxHeight: 320, objectFit: "cover" }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={capturePhoto}>
            Capture photo
          </button>
          <button type="button" className="btn btn-ghost" onClick={cancelCamera}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        padding: 22,
        borderRadius: "var(--radius-md)",
        border: "1.5px dashed var(--color-divider)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ fontSize: 22 }}>📷</span>
      <button type="button" className="btn btn-secondary" disabled={phase === "starting"} onClick={openCamera}>
        {phase === "starting" ? "Opening camera…" : "Open camera"}
      </button>
      <span style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)", textAlign: "center" }}>
        Connect a phone as a USB camera, or use a webcam.
      </span>
      {error && <p style={{ fontSize: 12.5, color: "var(--color-accent-800)", margin: 0, textAlign: "center" }}>{error}</p>}
    </div>
  );
}
