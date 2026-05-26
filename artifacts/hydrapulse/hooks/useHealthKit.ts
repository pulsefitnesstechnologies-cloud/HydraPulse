import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

export interface HealthSnapshot {
  heartRate: number | null;
  hrv: number | null;
  sampleCount: number; // how many HR samples were averaged
  lastUpdated: string | null;
  /** Unix ms of the most recent HR sample recorded by the Watch, or null if no sample found. */
  mostRecentSampleMs: number | null;
}

const HR_WINDOW_MS = 60 * 60 * 1000; // 1 hour — keeps data recent & relevant
const HRV_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours — HRV updates less frequently
const HR_SAMPLE_LIMIT = 10;
const HRV_SAMPLE_LIMIT = 5;

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

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

export function useHealthKit() {
  const [isAvailable, setIsAvailable] = useState(Platform.OS === "ios");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [snapshot, setSnapshot] = useState<HealthSnapshot>({
    heartRate: null,
    hrv: null,
    sampleCount: 0,
    lastUpdated: null,
    mostRecentSampleMs: null,
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

  // Fetch multiple recent samples and average them for higher accuracy.
  // HR: up to 10 samples from the past hour.
  // HRV: up to 5 samples from the past 2 hours (updates less often).
  const fetchLatest = useCallback(async (): Promise<HealthSnapshot | null> => {
    if (!isAuthorized || Platform.OS !== "ios") return null;
    const hk = getHK();
    if (!hk) return null;
    setIsLoading(true);

    const hrStart = new Date(Date.now() - HR_WINDOW_MS);
    const hrvStart = new Date(Date.now() - HRV_WINDOW_MS);
    const endDate = new Date();

    const [hrSamples, hrvSamples] = await Promise.all([
      hk.queryQuantitySamples("HKQuantityTypeIdentifierHeartRate", {
        filter: { date: { startDate: hrStart, endDate } },
        limit: HR_SAMPLE_LIMIT,
        ascending: false, // newest first
      }).catch(() => [] as readonly import("@kingstinct/react-native-healthkit").QuantitySample[]),
      hk.queryQuantitySamples("HKQuantityTypeIdentifierHeartRateVariabilitySDNN", {
        filter: { date: { startDate: hrvStart, endDate } },
        limit: HRV_SAMPLE_LIMIT,
        ascending: false,
      }).catch(() => [] as readonly import("@kingstinct/react-native-healthkit").QuantitySample[]),
    ]);

    // hrSamples is sorted newest-first (ascending: false), so [0] is the most recent.
    const mostRecentSampleMs = hrSamples.length > 0
      ? new Date(hrSamples[0].endDate).getTime()
      : null;

    const snap: HealthSnapshot = {
      heartRate: average(hrSamples.map((s) => s.quantity)),
      hrv: average(hrvSamples.map((s) => s.quantity)),
      sampleCount: hrSamples.length,
      lastUpdated: new Date().toISOString(),
      mostRecentSampleMs,
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
