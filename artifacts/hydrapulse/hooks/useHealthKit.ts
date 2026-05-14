import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import AppleHealthKit, { HealthKitPermissions } from "react-native-health";

export interface HealthSnapshot {
  heartRate: number | null;
  hrv: number | null;
  lastUpdated: string | null;
}

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.HeartRateVariability,
    ],
    write: [],
  },
};

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
    AppleHealthKit.isAvailable((err, available) => {
      if (!err && available) setIsAvailable(true);
    });
  }, []);

  const requestAuthorization = useCallback((): Promise<boolean> => {
    if (Platform.OS !== "ios" || !isAvailable) return Promise.resolve(false);
    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(PERMISSIONS, (err) => {
        if (err) {
          resolve(false);
        } else {
          setIsAuthorized(true);
          resolve(true);
        }
      });
    });
  }, [isAvailable]);

  const fetchLatest = useCallback(async () => {
    if (!isAuthorized || Platform.OS !== "ios") return;
    setIsLoading(true);

    const options = {
      startDate: new Date(Date.now() - WINDOW_MS).toISOString(),
      endDate: new Date().toISOString(),
      ascending: false,
      limit: 1,
    };

    const hrPromise = new Promise<number | null>((resolve) => {
      AppleHealthKit.getHeartRateSamples(options, (err, results) => {
        if (err || !results || results.length === 0) resolve(null);
        else resolve(Math.round(results[0].value));
      });
    });

    const hrvPromise = new Promise<number | null>((resolve) => {
      AppleHealthKit.getHeartRateVariabilitySamples(options, (err, results) => {
        if (err || !results || results.length === 0) resolve(null);
        else resolve(Math.round(results[0].value));
      });
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
