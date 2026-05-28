import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

export interface HealthSnapshot {
  heartRate: number | null;
  hrv: number | null;
  sampleCount: number;
  lastUpdated: string | null;
  /** Unix ms of the most recent HR sample recorded by the Watch, or null if no sample found. */
  mostRecentSampleMs: number | null;
  /**
   * User's personal 30-day average resting heart rate (Apple's nightly compute).
   * Used by the personalized hydration algorithm instead of population thresholds.
   */
  baselineRestingHR: number | null;
  /**
   * User's personal 30-day average HRV SDNN.
   * Used by the personalized hydration algorithm instead of population thresholds.
   */
  baselineHRV: number | null;
}

// Live HR window: 3 hours gives 10–20 samples for a stable weighted average.
const HR_WINDOW_MS = 3 * 60 * 60 * 1000;
const HR_SAMPLE_LIMIT = 24;

// Baseline window: 30 days of Apple-computed resting HR and HRV.
// Recent samples (first few) are used for the current reading blend;
// the full 30-day set is averaged to form the user's personal baseline.
const BASELINE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const BASELINE_SAMPLE_LIMIT = 30;

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

/** Simple unweighted average — used for computing long-term personal baselines. */
function simpleAverage(values: number[]): number | null {
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
    baselineRestingHR: null,
    baselineHRV: null,
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
    const baselineStart = new Date(Date.now() - BASELINE_WINDOW_MS);
    const endDate = new Date();

    // All four queries run in parallel for speed.
    // hrSamples       — live readings (3 h) for current HR estimate
    // restingHRSamples — Apple's nightly resting HR (30 days): first 3 used to
    //                   blend into current reading, all 30 averaged for baseline
    // hrvRecentSamples — live HRV (use first 12 for current reading)
    // hrvAllSamples    — 30-day HRV for personal baseline average
    const empty = [] as readonly import("@kingstinct/react-native-healthkit").QuantitySample[];
    const [hrSamples, restingHRSamples, hrvRecentSamples, hrvAllSamples] = await Promise.all([
      hk.queryQuantitySamples("HKQuantityTypeIdentifierHeartRate", {
        filter: { date: { startDate: hrStart, endDate } },
        limit: HR_SAMPLE_LIMIT,
        ascending: false,
      }).catch(() => empty),
      hk.queryQuantitySamples("HKQuantityTypeIdentifierRestingHeartRate", {
        filter: { date: { startDate: baselineStart, endDate } },
        limit: BASELINE_SAMPLE_LIMIT,
        ascending: false,
      }).catch(() => empty),
      hk.queryQuantitySamples("HKQuantityTypeIdentifierHeartRateVariabilitySDNN", {
        filter: { date: { startDate: hrStart, endDate } }, // recent window for current HRV
        limit: 12,
        ascending: false,
      }).catch(() => empty),
      hk.queryQuantitySamples("HKQuantityTypeIdentifierHeartRateVariabilitySDNN", {
        filter: { date: { startDate: baselineStart, endDate } }, // 30-day window for baseline
        limit: BASELINE_SAMPLE_LIMIT,
        ascending: false,
      }).catch(() => empty),
    ]);

    // Newest live HR sample timestamp (used for "is Watch worn?" check)
    const mostRecentSampleMs = hrSamples.length > 0
      ? new Date(hrSamples[0].endDate).getTime()
      : null;

    // Current HR: exponential weighted average of live samples
    const liveHR = weightedAverage(hrSamples.map((s) => s.quantity));

    // Blend in Apple's resting HR when live sample count is low.
    // Use only the most recent 3 resting HR values for the current-reading blend.
    const recentRestingHRValues = restingHRSamples.slice(0, 3).map((s) => s.quantity);
    let heartRate: number | null = liveHR;
    if (recentRestingHRValues.length > 0) {
      const restingHR = weightedAverage(recentRestingHRValues);
      if (restingHR !== null) {
        if (liveHR === null) {
          heartRate = restingHR;
        } else if (hrSamples.length < 4) {
          const liveWeight = 0.6 + hrSamples.length * 0.05; // 0.65–0.80
          heartRate = Math.round(liveHR * liveWeight + restingHR * (1 - liveWeight));
        }
      }
    }

    // Personal baselines — simple (unweighted) averages over 30 days so short-
    // term fluctuations don't skew the reference point.
    const baselineRestingHR = simpleAverage(restingHRSamples.map((s) => s.quantity));
    const baselineHRV = simpleAverage(hrvAllSamples.map((s) => s.quantity));

    const snap: HealthSnapshot = {
      heartRate,
      hrv: weightedAverage(hrvRecentSamples.map((s) => s.quantity)),
      sampleCount: hrSamples.length,
      lastUpdated: new Date().toISOString(),
      mostRecentSampleMs,
      baselineRestingHR,
      baselineHRV,
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
