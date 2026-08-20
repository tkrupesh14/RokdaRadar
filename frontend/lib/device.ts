// Best-effort mobile detection to pick the evidence-capture flow: on a
// phone, a plain file input with capture="environment" opens the native
// camera app directly (real, works today). On desktop there's no
// equivalent -- see components/EvidenceCapture.tsx for the getUserMedia
// live-camera fallback.
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData?.mobile !== undefined) return uaData.mobile;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
