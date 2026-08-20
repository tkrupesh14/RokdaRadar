import { useEffect, useRef, useState } from "react";

export type LocationStatus = "idle" | "locating" | "ready" | "error";

export type Coords = { lat: number; lng: number; accuracy: number };

export type LiveLocation = {
  status: LocationStatus;
  coords: Coords | null;
  label: string | null; // reverse-geocoded place name, once resolved
  error: string | null;
};

// Reverse-geocoding is throttled by both time and distance so a live
// watchPosition() feed (which can fire every few seconds) doesn't hammer the
// geocoder -- OpenStreetMap's Nominatim (free, no API key) asks for at most
// ~1 request/sec and discourages polling.
const REGEOCODE_MIN_INTERVAL_MS = 20_000;
const REGEOCODE_MIN_MOVE_METERS = 30;

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address ?? {};
    const place = addr.village || addr.town || addr.suburb || addr.city_district || addr.city || addr.county;
    const region = addr.state_district || addr.state;
    return [place, region].filter(Boolean).join(", ") || data.display_name || null;
  } catch {
    return null;
  }
}

// Live GPS location for the evidence "location tagged" line: watches
// position continuously (not a single one-shot read) and resolves a
// human-readable place name in the background as the operator moves.
export function useLiveLocation(enabled = true): LiveLocation {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lastGeocodedAt = useRef(0);
  const lastGeocodedCoords = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      // Feature-detecting a browser API can only happen once mounted client-side.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("error");
      setError("Location is not supported by this browser.");
      return;
    }

    setStatus("locating");

    const handlePosition = (pos: GeolocationPosition) => {
      const next: Coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      setCoords(next);
      setStatus("ready");
      setError(null);

      const now = Date.now();
      const movedEnough =
        !lastGeocodedCoords.current || haversineMeters(lastGeocodedCoords.current, next) > REGEOCODE_MIN_MOVE_METERS;
      const dueForRefresh = now - lastGeocodedAt.current > REGEOCODE_MIN_INTERVAL_MS;
      if (movedEnough || dueForRefresh) {
        lastGeocodedAt.current = now;
        lastGeocodedCoords.current = next;
        reverseGeocode(next.lat, next.lng).then((placeLabel) => {
          if (placeLabel) setLabel(placeLabel);
        });
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      setStatus("error");
      setError(err.code === err.PERMISSION_DENIED ? "Location permission denied." : "Could not determine location.");
    };

    const watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 20_000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return { status, coords, label, error };
}
