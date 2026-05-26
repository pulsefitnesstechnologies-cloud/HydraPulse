import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

export interface HealthSnapshot {
  heartRate: number | null;
  hrv: number | null;
  sampleCount: number;
  lastUpdated: string | null;
  /** Unix ms of the most recent HR sample recorded by the Watch, or null if no sample found. */
  mostRecentSampleMs: number | null;
}

// Wider windows give more samples → more stable weighted average.
// Apple Watch records HR roughly every 5-15 min during rest, so a 3-hour window
// reliably yields 10+ samples even for infrequent recordings.
const HR_WINDOW_MS = 3 * 60 * 60 * 1000;   // 3 hours
const HRV_WINDOW_MS = 6 * 60 * 60 * 1000;  // 6 hours (HRV updates far less frequently)
const HR_SAMPLE_LIMIT = 24;
const HRV_SAMPLE_LIMIT = 12;

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

/**
 * Exponentially-weighted average giving more weight to the most recent sample.
 * samples[0] is the NEWEST (queries use ascending: false).
 * decay controls how fast older samples are down-weighted (0.18 = ~80% weight
 * on the 5 most recent vs flat 50/50 for a simple mean across all).
 */
function weightedAverage(values: number[]): number | null {
  if (!values.length) return null;
  const decay = 0.18;
  let weightSum = 0;
  let total = 0;
  for (let i = 0; i < values.length; i++) {
    const w = Math.exp(-i * decay);
    total += values[i] * w;
    weightSum += w;
  }
  return Math.round(total / weightSum);
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
        "HKQuantityTypeIdentifierRestingHeartRate",
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

  /**
   * Fetches multiple recent HR and HRV samples and returns a weighted average.
   * Uses exponential weighting so the most recent readings have the most
   * influence on the result, while still benefiting from the stability of
   * averaging many samples.
   *
   * Also reads resting heart rate (computed by Apple over a longer window and
   * is inherently smoother) and uses it as a fallback / blended value when
   * the live sample count is low.
   */
  const fetchLatest = useCallback(async (): Promise<HealthSnapshot | null> => {
    if (!isAuthorized || Platform.OS !== "ios") return null;
    const hk = getHK();
    if (!hk) return null;
    setIsLoading(true);

    const hrStart = new Date(Date.now() - HR_WINDOW_MS);
    const hrvStart = new Date(Date.now() - HRV_WINDOW_MS);
    const endDate = new Date();

    const [hrSamples, hrvSamples, restingHRSamples] = await Promise.all([
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
      hk.queryQuantitySamples("HKQuantityTypeIdentifierRestingHeartRate", {
        filter: { date: { startDate: hrStart, endDate } },
        limit: 3,
        ascending: false,
      }).catch(() => [] as readonly import("@kingstinct/react-native-healthkit").QuantitySample[]),
    ]);

    // Newest HR sample timestamp
    const mostRecentSampleMs = hrSamples.length > 0
      ? new Date(hrSamples[0].endDate).getTime()
      : null;

    // Weighted average of live samples
    const liveHR = weightedAverage(hrSamples.map((s) => s.quantity));

    // Blend in resting HR when few live samples exist — resting HR is Apple's
    // own nightly average which is much smoother and less noisy.
    let heartRate: number | null = liveHR;
    if (restingHRSamples.length > 0) {
      const restingHR = weightedAverage(restingHRSamples.map((s) => s.quantity));
      if (restingHR !== null) {
        if (liveHR === null) {
          heartRate = restingHR;
        } else if (hrSamples.length < 4) {
          // Blend: weight live reading more when we have some samples
          const liveWeight = 0.6 + hrSamples.length * 0.05; // 0.65–0.80
          heartRate = Math.round(liveHR * liveWeight + restingHR * (1 - liveWeight));
        }
      }
    }

    const snap: HealthSnapshot = {
      heartRate,
      hrv: weightedAverage(hrvSamples.map((s) => s.quantity)),
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
