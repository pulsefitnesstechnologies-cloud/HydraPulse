import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

export interface HealthSnapshot {
  heartRate: number | null;
  hrv: number | null;
  lastUpdated: string | null;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

// Lazy-require keeps the JS bundle from crashing on Android/web where the
// native module is absent. All calls are guarded by Platform.OS === "ios".
function hk() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@kingstinct/react-native-healthkit") as typeof import("@kingstinct/react-native-healthkit");
  } catch {
    return null;
  }
}

export function useHealthKit() {
  const [isAvailable, setIsAvailable] = useState(Platform.OS === "ios");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [snapshot, setSnapshot] = useState<HealthSnapshot>({
    heartRate: null,
    hrv: null,
    lastUpdated: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Check device-level HealthKit availability (simulator returns false)
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const mod = hk();
    if (!mod) { setIsAvailable(false); return; }
    try {
      if (!mod.isHealthDataAvailable()) setIsAvailable(false);
    } catch {}
  }, []);

  // Show the system HealthKit permission sheet.
  // NOTE: HealthKit always resolves the promise even when the user denies —
  // this is enforced by Apple to prevent apps detecting denial. We treat
  // a successful resolve as "authorization requested" and set isAuthorized.
  const requestAuthorization = useCallback((): Promise<boolean> => {
    if (Platform.OS !== "ios") return Promise.resolve(false);
    const mod = hk();
    if (!mod) return Promise.resolve(false);

    return mod
      .requestAuthorization({
        toRead: [
          "HKQuantityTypeIdentifierHeartRate",
          "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
        ],
        toShare: [],
      })
      .then((ok) => {
        // ok is always true unless there was a native-level error
        if (ok) {
          setIsAuthorized(true);
          setIsAvailable(true);
        }
        return ok;
      })
      .catch(() => false);
  }, []);

  // Read the most recent HR and HRV samples from the last 24 hours.
  const fetchLatest = useCallback(async () => {
    if (!isAuthorized || Platform.OS !== "ios") return;
    const mod = hk();
    if (!mod) return;
    setIsLoading(true);

    const opts = {
      startDate: new Date(Date.now() - WINDOW_MS),
      endDate: new Date(),
      limit: 1,
      ascending: false,
    };

    try {
      const [hrSamples, hrvSamples] = await Promise.all([
        mod.queryQuantitySamples("HKQuantityTypeIdentifierHeartRate", opts).catch(() => []),
        mod.queryQuantitySamples("HKQuantityTypeIdentifierHeartRateVariabilitySDNN", opts).catch(() => []),
      ]);

      // quantity is already in the native HealthKit unit:
      //   HeartRate             → count/min  (BPM)
      //   HeartRateVariabilitySDNN → ms
      setSnapshot({
        heartRate: hrSamples[0]?.quantity != null
          ? Math.round(hrSamples[0].quantity)
          : null,
        hrv: hrvSamples[0]?.quantity != null
          ? Math.round(hrvSamples[0].quantity)
          : null,
        lastUpdated: new Date().toISOString(),
      });
    } catch {}

    setIsLoading(false);
  }, [isAuthorized]);

  useEffect(() => {
    if (isAuthorized) fetchLatest();
  }, [isAuthorized, fetchLatest]);

  return {
    isAvailable,
    isAuthorized,
    snapshot,
    isLoading,
    requestAuthorization,
    fetchLatest,
  };
}
