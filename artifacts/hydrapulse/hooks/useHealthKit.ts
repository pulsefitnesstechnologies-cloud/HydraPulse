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
  const [isAvailable, setIsAvailable] = useState(false);
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
    if (!hk) return;
    try {
      hk.isAvailable((err: unknown, available: boolean) => {
        if (!err && available) setIsAvailable(true);
      });
    } catch {}
  }, []);

  const requestAuthorization = useCallback((): Promise<boolean> => {
    if (Platform.OS !== "ios" || !isAvailable) return Promise.resolve(false);
    const hk = getHK();
    if (!hk) return Promise.resolve(false);
    const permissions = {
      permissions: {
        read: [
          hk.Constants.Permissions.HeartRate,
          hk.Constants.Permissions.HeartRateVariability,
        ],
        write: [] as import("react-native-health").HealthPermission[],
      },
    };
    return new Promise((resolve) => {
      try {
        hk.initHealthKit(permissions, (err: unknown) => {
          if (err) resolve(false);
          else {
            setIsAuthorized(true);
            resolve(true);
          }
        });
      } catch {
        resolve(false);
      }
    });
  }, [isAvailable]);

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
        hk.getHeartRateSamples(options, (err: unknown, results: Array<{ value: number }>) => {
          if (err || !results?.length) resolve(null);
          else resolve(Math.round(results[0].value));
        });
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
