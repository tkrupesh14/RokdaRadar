import { useEffect, useState } from "react";

// Chrome/Edge/Android expose navigator.connection (Network Information API);
// Safari/Firefox don't, so every field here is optional and callers must
// treat its absence as "quality unknown," falling back to navigator.onLine.
type NetworkInformation = {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  downlink?: number;
  saveData?: boolean;
  addEventListener?: (type: "change", handler: () => void) => void;
  removeEventListener?: (type: "change", handler: () => void) => void;
};

declare global {
  interface Navigator {
    connection?: NetworkInformation;
  }
}

export type NetworkStatus = "offline" | "poor" | "online";

function readStatus(): NetworkStatus {
  if (typeof navigator === "undefined") return "online";
  if (!navigator.onLine) return "offline";
  const conn = navigator.connection;
  if (conn && (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g" || (conn.downlink ?? Infinity) < 0.5)) {
    return "poor";
  }
  return "online";
}

// Tracks real connectivity: navigator.onLine for offline/online transitions,
// plus the Network Information API (where the browser supports it) to catch
// "technically online but effectively unusable" field conditions -- exactly
// the case an operator recording spends from a relief camp needs surfaced.
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => readStatus());

  useEffect(() => {
    const update = () => setStatus(readStatus());
    update();

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    navigator.connection?.addEventListener?.("change", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      navigator.connection?.removeEventListener?.("change", update);
    };
  }, []);

  return status;
}
