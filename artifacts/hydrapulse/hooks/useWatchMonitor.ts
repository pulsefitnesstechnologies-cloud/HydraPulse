import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

const INTERVAL_KEY = "@hydrapulse:watchInterval";
const NOTIF_ID_KEY = "@hydrapulse:watchNotifId";
const WATCH_CHANNEL = "hydrapulse-watch-monitor";

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
  // HRV only
  if ((hrv as number) >= 60) return 3;
  if ((hrv as number) >= 30) return 2;
  return 1;
}

export const WATCH_INTERVALS = [0, 1, 2, 3, 4, 6, 8, 12, 24] as const;
export type WatchInterval = (typeof WATCH_INTERVALS)[number];

// Cancel any previously scheduled watch-monitor notification and schedule a
// fresh repeating one at the given interval.  Passing 0 just cancels.
async function reschedule(hours: WatchInterval): Promise<void> {
  // Cancel old notification
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

export function useWatchMonitor(opts?: {
  onLowHydration?: (score: 1 | 2) => void;
  getLatestHR: () => number | null;
  getLatestHRV: () => number | null;
}) {
  const [watchInterval, setWatchIntervalState] = useState<WatchInterval>(0);

  // Load saved interval on mount
  useEffect(() => {
    if (Platform.OS === "web") return;
    AsyncStorage.getItem(INTERVAL_KEY)
      .then((raw) => {
        if (raw) {
          const v = parseInt(raw, 10) as WatchInterval;
          if ((WATCH_INTERVALS as readonly number[]).includes(v))
            setWatchIntervalState(v);
        }
      })
      .catch(() => {});
  }, []);

  // When the app comes to the foreground, read the latest HealthKit snapshot
  // and notify if hydration appears low.
  useEffect(() => {
    if (Platform.OS === "web" || !opts) return;

    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const hr = opts.getLatestHR();
      const hrv = opts.getLatestHRV();
      const score = estimateHydrationFromMetrics(hr, hrv);
      if (score !== null && score <= 2) {
        opts.onLowHydration?.(score as 1 | 2);
      }
    });

    return () => sub.remove();
  }, [opts]);

  const setWatchInterval = useCallback(async (hours: WatchInterval) => {
    if (Platform.OS === "web") return;
    setWatchIntervalState(hours);
    await AsyncStorage.setItem(INTERVAL_KEY, String(hours)).catch(() => {});
    await reschedule(hours);
  }, []);

  return { watchInterval, setWatchInterval };
}
