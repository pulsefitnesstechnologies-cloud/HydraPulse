import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

export interface HealthSnapshot {
  heartRate: number | null;
  hrv: number | null;
  lastUpdated: string | null;
}

// Lazy-require so a missing native module never crashes the JS bundle
function getHK() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("react-native-health");
    return (mod.default ?? mod) as typeof import("react-native-health").default;
  } catch {
    return null;
  }
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

export function useHealthKit() {
  // Assume available on real iOS devices (all modern iPhones support HealthKit).
  // Only explicitly mark unavailable if the native callback says so.
  const [isAvailable, setIsAvailable] = useState(Platform.OS === "ios");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [snapshot, setSnapshot] = useState<HealthSnapshot>({
    heartRate: null,
    hrv: null,
    lastUpdated: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const hk = getHK();
    if (!hk) {
      setIsAvailable(false);
      return;
    }
    try {
      hk.isAvailable((err: unknown, available: boolean) => {
        // Only set false if the device explicitly reports unavailable
        if (!err && !available) setIsAvailable(false);
      });
    } catch {}
  }, []);

  // Try to request authorization. We no longer gate on isAvailable so the
  // HealthKit permission sheet appears on first tap even before the async
  // isAvailable callback fires.
  const requestAuthorization = useCallback((): Promise<boolean> => {
    if (Platform.OS !== "ios") return Promise.resolve(false);
    const hk = getHK();
    if (!hk) return Promise.resolve(false);

    const permissions = {
      permissions: {
        read: [
          hk.Constants.Permissions.HeartRate,
          hk.Constants.Permissions.HeartRateVariability,
          hk.Constants.Permissions.Weight,
        ],
        write: [] as import("react-native-health").HealthPermission[],
      },
    };

    return new Promise((resolve) => {
      try {
        hk.initHealthKit(permissions, (err: unknown) => {
          if (err) {
            resolve(false);
          } else {
            setIsAuthorized(true);
            setIsAvailable(true);
            resolve(true);
          }
        });
      } catch {
        resolve(false);
      }
    });
  }, []);

  const fetchLatest = useCallback(async () => {
    if (!isAuthorized || Platform.OS !== "ios") return;
    const hk = getHK();
    if (!hk) return;
    setIsLoading(true);

    const options = {
      startDate: new Date(Date.now() - WINDOW_MS).toISOString(),
      endDate: new Date().toISOString(),
      ascending: false,
      limit: 1,
    };

    const hrPromise = new Promise<number | null>((resolve) => {
      try {
        hk.getHeartRateSamples(
          options,
          (err: unknown, results: Array<{ value: number }>) => {
            if (err || !results?.length) resolve(null);
            else resolve(Math.round(results[0].value));
          }
        );
      } catch {
        resolve(null);
      }
    });

    const hrvPromise = new Promise<number | null>((resolve) => {
      try {
        hk.getHeartRateVariabilitySamples(
          options,
          (err: unknown, results: Array<{ value: number }>) => {
            if (err || !results?.length) resolve(null);
            else resolve(Math.round(results[0].value));
          }
        );
      } catch {
        resolve(null);
      }
    });

    const [heartRate, hrv] = await Promise.all([hrPromise, hrvPromise]);
    setSnapshot({ heartRate, hrv, lastUpdated: new Date().toISOString() });
    setIsLoading(false);
  }, [isAuthorized]);

  useEffect(() => {
    if (isAuthorized) fetchLatest();
  }, [isAuthorized, fetchLatest]);

  return { isAvailable, isAuthorized, snapshot, isLoading, requestAuthorization, fetchLatest };
}
