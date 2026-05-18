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
// react-native-health may use CommonJS exports (module.exports = Kit) or ESM
// default exports — handle both with the `?.default ?? mod` pattern.
let _hkCache: typeof import("react-native-health").default | null | undefined;
let _hkLoadError: string | null = null;

function hk() {
  if (_hkCache !== undefined) return _hkCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-health");
    _hkCache = (mod?.default ?? mod) as typeof import("react-native-health").default;
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

  // Show the system HealthKit permission sheet.
  // Returns { ok, error } — error is the raw string from initHealthKit on failure.
  const requestAuthorization = useCallback((): Promise<{ ok: boolean; error?: string }> => {
    if (Platform.OS !== "ios") return Promise.resolve({ ok: false, error: "iOS only" });
    const AppleHealthKit = hk();
    if (!AppleHealthKit) {
      setIsAvailable(false);
      return Promise.resolve({
        ok: false,
        error: _hkLoadError ?? "react-native-health module not found",
      });
    }

    return new Promise((resolve) => {
      // 12-second timeout — if the provisioning profile is missing the
      // HealthKit entitlement, iOS silently drops the initHealthKit call and
      // the callback never fires, leaving the UI frozen with no feedback.
      const timer = setTimeout(() => {
        resolve({
          ok: false,
          error:
            "Timed out — HealthKit entitlement is likely missing from the " +
            "provisioning profile. Run: eas credentials --platform ios → " +
            "delete provisioning profile → rebuild.",
        });
      }, 12000);

      // If the native module didn't register (missing entitlement in
      // provisioning profile), initHealthKit will be undefined and calling
      // it throws. Catch this early with a clear actionable message.
      if (typeof AppleHealthKit.initHealthKit !== "function") {
        clearTimeout(timer);
        resolve({
          ok: false,
          error:
            "RNAppleHealthKit native module not registered. The App ID in " +
            "Apple Developer Portal must have HealthKit capability enabled. " +
            "Visit developer.apple.com → Identifiers → com.hydrapulse.app → " +
            "enable HealthKit → then delete the provisioning profile in " +
            "'eas credentials' and rebuild.",
        });
        return;
      }

      try {
        AppleHealthKit.initHealthKit(
          {
            permissions: {
              read: [
                AppleHealthKit.Constants.Permissions.HeartRate,
                AppleHealthKit.Constants.Permissions.HeartRateVariability,
              ],
              write: [
                // Writing water consumption gives iOS Health a concrete write
                // permission to display, making HydraPulse appear in Health →
                // Apps even when the user hasn't granted read yet.
                AppleHealthKit.Constants.Permissions.Water,
              ],
            },
          },
          (err: unknown) => {
            clearTimeout(timer);
            if (err) {
              const errStr =
                typeof err === "string"
                  ? err
                  : typeof err === "object" && err !== null
                  ? JSON.stringify(err)
                  : String(err);
              console.warn("[useHealthKit] initHealthKit error:", errStr);
              resolve({ ok: false, error: errStr });
            } else {
              setIsAuthorized(true);
              resolve({ ok: true });
            }
          }
        );
      } catch (e) {
        clearTimeout(timer);
        resolve({ ok: false, error: `initHealthKit threw: ${String(e)}` });
      }
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
