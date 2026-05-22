import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

const INTERVAL_KEY = "@hydrapulse:watchInterval";
const NOTIF_ID_KEY = "@hydrapulse:watchNotifId";
const ALERT_KEY = "@hydrapulse:alertThreshold";
const LAST_AUTO_SCAN_KEY = "@hydrapulse:lastAutoScan";

export function estimateHydrationFromMetrics(
  hr: number | null,
  hrv: number | null
): 1 | 2 | 3 | 4 | null {
  if (hr === null && hrv === null) return null;
  if (hr !== null && hrv !== null) {
    if (hr <= 65 && hrv >= 60) return 4;
    if (hr <= 80 && hrv >= 40) return 3;
    if (hr <= 92 && hrv >= 22) return 2;
    return 1;
  }
  if (hr !== null) {
    if (hr <= 70) return 3;
    if (hr <= 88) return 2;
    return 1;
  }
  if ((hrv as number) >= 60) return 3;
  if ((hrv as number) >= 30) return 2;
  return 1;
}

export const WATCH_INTERVALS = [0, 1, 2, 3, 4, 6, 8, 12, 24] as const;
export type WatchInterval = (typeof WATCH_INTERVALS)[number];

export const ALERT_THRESHOLDS = [0, 1, 2, 3] as const;
export type AlertThreshold = (typeof ALERT_THRESHOLDS)[number];
export const ALERT_THRESHOLD_LABELS: Record<AlertThreshold, string> = {
  0: "Off",
  1: "Critical only",
  2: "Low or below",
  3: "Good or below",
};

const SCORE_LABELS: Record<number, string> = {
  1: "critical",
  2: "low",
  3: "below your target",
};

async function reschedule(hours: WatchInterval): Promise<void> {
  const oldId = await AsyncStorage.getItem(NOTIF_ID_KEY).catch(() => null);
  if (oldId) {
    await Notifications.cancelScheduledNotificationAsync(oldId).catch(() => {});
    await AsyncStorage.removeItem(NOTIF_ID_KEY).catch(() => {});
  }

  if (hours === 0 || Platform.OS === "web") return;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Hydration Check",
      body: "Open HydraPulse to read your Apple Watch data and check your hydration level.",
      sound: false,
      data: { type: "watch-monitor" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: hours * 3600,
      repeats: true,
    },
  });

  await AsyncStorage.setItem(NOTIF_ID_KEY, id).catch(() => {});
}

async function sendThresholdAlert(scoreLabel: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Low Hydration Alert",
        body: `Your hydration appears ${scoreLabel}. Consider drinking some water soon.`,
        sound: false,
        data: { type: "hydration-alert" },
      },
      trigger: null,
    });
  } catch {}
}

export function useWatchMonitor(opts?: {
  // Returns the computed hydration score (1-4) or null if no data
  onAutoScan?: () => Promise<number | null>;
}) {
  const [watchInterval, setWatchIntervalState] = useState<WatchInterval>(0);
  const [alertThreshold, setAlertThresholdState] = useState<AlertThreshold>(0);

  // Keep the callback ref fresh without recreating the effect
  const onAutoScanRef = useRef(opts?.onAutoScan);
  useEffect(() => {
    onAutoScanRef.current = opts?.onAutoScan;
  }, [opts?.onAutoScan]);

  // Load persisted values on mount
  useEffect(() => {
    if (Platform.OS === "web") return;
    Promise.all([
      AsyncStorage.getItem(INTERVAL_KEY),
      AsyncStorage.getItem(ALERT_KEY),
    ])
      .then(([intervalRaw, alertRaw]) => {
        if (intervalRaw) {
          const v = parseInt(intervalRaw, 10) as WatchInterval;
          if ((WATCH_INTERVALS as readonly number[]).includes(v)) setWatchIntervalState(v);
        }
        if (alertRaw) {
          const v = parseInt(alertRaw, 10) as AlertThreshold;
          if ((ALERT_THRESHOLDS as readonly number[]).includes(v)) setAlertThresholdState(v);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-scan when app returns to foreground and interval has elapsed
  useEffect(() => {
    if (Platform.OS === "web") return;

    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;
      if (watchInterval === 0) return;

      const lastRaw = await AsyncStorage.getItem(LAST_AUTO_SCAN_KEY).catch(() => null);
      const last = lastRaw ? parseInt(lastRaw, 10) : 0;
      const intervalMs = watchInterval * 3600 * 1000;

      if (Date.now() - last < intervalMs) return;

      const score = await onAutoScanRef.current?.();
      if (score == null) return;

      await AsyncStorage.setItem(LAST_AUTO_SCAN_KEY, String(Date.now())).catch(() => {});

      if (alertThreshold > 0 && score <= alertThreshold) {
        await sendThresholdAlert(SCORE_LABELS[score] ?? "low");
      }
    });

    return () => sub.remove();
  }, [watchInterval, alertThreshold]);

  const setWatchInterval = useCallback(async (hours: WatchInterval) => {
    if (Platform.OS === "web") return;
    setWatchIntervalState(hours);
    await AsyncStorage.setItem(INTERVAL_KEY, String(hours)).catch(() => {});
    await reschedule(hours);
  }, []);

  const setAlertThreshold = useCallback(async (v: AlertThreshold) => {
    if (Platform.OS === "web") return;
    setAlertThresholdState(v);
    await AsyncStorage.setItem(ALERT_KEY, String(v)).catch(() => {});
  }, []);

  return { watchInterval, setWatchInterval, alertThreshold, setAlertThreshold };
}
