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
    return require("react-native-health").default as typeof import("react-native-health").default;
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

  // Show the system HealthKit permission sheet.
  const requestAuthorization = useCallback((): Promise<boolean> => {
    if (Platform.OS !== "ios") return Promise.resolve(false);
    const AppleHealthKit = hk();
    if (!AppleHealthKit) {
      setIsAvailable(false);
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(
        {
          permissions: {
            read: [
              AppleHealthKit.Constants.Permissions.HeartRate,
              AppleHealthKit.Constants.Permissions.HeartRateVariability,
            ],
            write: [],
          },
        },
        (err: unknown) => {
          if (err) {
            // initHealthKit fails immediately on new arch if the interop layer
            // isn't bridging correctly — treat as unavailable rather than crash.
            console.warn("[useHealthKit] initHealthKit error:", err);
            setIsAvailable(false);
            resolve(false);
          } else {
            setIsAuthorized(true);
            resolve(true);
          }
        }
      );
    });
  }, []);

  // Read the most recent HR and HRV samples from the last 24 hours.
  const fetchLatest = useCallback(async () => {
    if (!isAuthorized || Platform.OS !== "ios") return;
    const AppleHealthKit = hk();
    if (!AppleHealthKit) return;
    setIsLoading(true);

    const startDate = new Date(Date.now() - WINDOW_MS).toISOString();
    const endDate = new Date().toISOString();
    const opts = { startDate, endDate, limit: 1, ascending: false };

    const hr = await new Promise<number | null>((resolve) => {
      AppleHealthKit.getHeartRateSamples(
        opts,
        (err: unknown, results: Array<{ value: number }>) => {
          if (err || !results?.length) resolve(null);
          else resolve(Math.round(results[0].value));
        }
      );
    });

    const hrv = await new Promise<number | null>((resolve) => {
      AppleHealthKit.getHeartRateVariabilitySamples(
        opts,
        (err: unknown, results: Array<{ value: number }>) => {
          if (err || !results?.length) resolve(null);
          else resolve(Math.round(results[0].value));
        }
      );
    });

    setSnapshot({
      heartRate: hr,
      hrv,
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
