import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

export interface HealthSnapshot {
  heartRate: number | null;
  hrv: number | null;
  lastUpdated: string | null;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

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

  // Returns the fresh snapshot so callers can act on it immediately
  const fetchLatest = useCallback(async (): Promise<HealthSnapshot | null> => {
    if (!isAuthorized || Platform.OS !== "ios") return null;
    const hk = getHK();
    if (!hk) return null;
    setIsLoading(true);

    const startDate = new Date(Date.now() - WINDOW_MS);
    const endDate = new Date();

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

    const snap: HealthSnapshot = {
      heartRate: hrSamples.length ? Math.round(hrSamples[0].quantity) : null,
      hrv: hrvSamples.length ? Math.round(hrvSamples[0].quantity) : null,
      lastUpdated: new Date().toISOString(),
    };
    setSnapshot(snap);
    setIsLoading(false);
    return snap;
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
