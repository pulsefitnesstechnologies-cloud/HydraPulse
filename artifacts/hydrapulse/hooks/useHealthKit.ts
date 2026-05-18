import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

export interface HealthSnapshot {
  heartRate: number | null;
  hrv: number | null;
  lastUpdated: string | null;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

// Lazy-require keeps the JS bundle from crashing on Android where the native
// module is absent. All call sites are guarded by Platform.OS === "ios".
//
// @kingstinct/react-native-healthkit v12 uses named exports — all functions
// (requestAuthorization, queryQuantitySamples, …) are top-level exports, not
// methods on a default object. Identifiers are string literals like
// 'HKQuantityTypeIdentifierHeartRate' rather than enum members.
type HKModule = typeof import("@kingstinct/react-native-healthkit");
let _hkCache: HKModule | null | undefined;
let _hkLoadError: string | null = null;

function getHK(): HKModule | null {
  if (_hkCache !== undefined) return _hkCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _hkCache = require("@kingstinct/react-native-healthkit") as HKModule;
  } catch (e) {
    _hkLoadError = String(e);
    _hkCache = null;
  }
  return _hkCache;
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

  // Shows the system HealthKit permission sheet.
  const requestAuthorization = useCallback((): Promise<{ ok: boolean; error?: string }> => {
    if (Platform.OS !== "ios") return Promise.resolve({ ok: false, error: "iOS only" });

    const hk = getHK();
    if (!hk) {
      setIsAvailable(false);
      return Promise.resolve({
        ok: false,
        error: _hkLoadError ?? "@kingstinct/react-native-healthkit module not found",
      });
    }

    // v12: requestAuthorization({ toShare?, toRead? }) — single object arg.
    return hk.requestAuthorization({
      toShare: ["HKQuantityTypeIdentifierDietaryWater"],
      toRead: [
        "HKQuantityTypeIdentifierHeartRate",
        "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
      ],
    })
      .then(() => {
        setIsAuthorized(true);
        return { ok: true as const };
      })
      .catch((e: unknown) => {
        const errStr = e instanceof Error ? e.message : String(e);
        return { ok: false as const, error: errStr };
      });
  }, []);

  // Read the most recent HR and HRV samples from the last 24 hours.
  const fetchLatest = useCallback(async () => {
    if (!isAuthorized || Platform.OS !== "ios") return;
    const hk = getHK();
    if (!hk) return;
    setIsLoading(true);

    const startDate = new Date(Date.now() - WINDOW_MS);
    const endDate = new Date();

    // v12: queryQuantitySamples(identifier, { filter: { date: { startDate, endDate } }, limit, ascending? })
    const [hrSamples, hrvSamples] = await Promise.all([
      hk.queryQuantitySamples("HKQuantityTypeIdentifierHeartRate", {
        filter: { date: { startDate, endDate } },
        limit: 1,
        ascending: false,
      }).catch(() => [] as readonly import("@kingstinct/react-native-healthkit").QuantitySample[]),
      hk.queryQuantitySamples("HKQuantityTypeIdentifierHeartRateVariabilitySDNN", {
        filter: { date: { startDate, endDate } },
        limit: 1,
        ascending: false,
      }).catch(() => [] as readonly import("@kingstinct/react-native-healthkit").QuantitySample[]),
    ]);

    setSnapshot({
      // Heart rate: HealthKit stores in count/min (BPM).
      heartRate: hrSamples.length ? Math.round(hrSamples[0].quantity) : null,
      // HRV SDNN: HealthKit stores in ms.
      hrv: hrvSamples.length ? Math.round(hrvSamples[0].quantity) : null,
      lastUpdated: new Date().toISOString(),
    });
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
