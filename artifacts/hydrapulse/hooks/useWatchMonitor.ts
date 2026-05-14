import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundFetch from "expo-background-fetch";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

const TASK_NAME = "hydrapulse-watch-monitor";
const INTERVAL_KEY = "@hydrapulse:watchInterval";

function getHK() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("react-native-health");
    return (mod.default ?? mod) as typeof import("react-native-health").default;
  } catch {
    return null;
  }
}

export function estimateHydrationFromMetrics(
  hr: number | null,
  hrv: number | null
): 1 | 2 | 3 | 4 | null {
  if (hr === null && hrv === null) return null;
  if (hr !== null && hrv !== null) {
    if (hr < 70 && hrv > 60) return 4;
    if (hr <= 80 && hrv > 40) return 3;
    if (hr <= 95 && hrv > 20) return 2;
    return 1;
  }
  if (hr !== null) {
    if (hr < 75) return 3;
    if (hr <= 90) return 2;
    return 1;
  }
  // HRV only
  if ((hrv as number) > 50) return 3;
  if ((hrv as number) >= 30) return 2;
  return 1;
}

async function readLatestMetrics(): Promise<{ hr: number | null; hrv: number | null }> {
  const hk = getHK();
  if (!hk) return { hr: null, hrv: null };

  const options = {
    startDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
    ascending: false,
    limit: 1,
  };

  const hr = await new Promise<number | null>((resolve) => {
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

  const hrv = await new Promise<number | null>((resolve) => {
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

  return { hr, hrv };
}

// Task definition must be at module-level (not inside a hook)
if (Platform.OS !== "web") {
  TaskManager.defineTask(TASK_NAME, async () => {
    try {
      const { hr, hrv } = await readLatestMetrics();
      const score = estimateHydrationFromMetrics(hr, hrv);

      if (score !== null && score <= 2) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Low Hydration Detected",
            body:
              score === 1
                ? "Your Apple Watch data indicates critical dehydration. Drink water now."
                : "Your Apple Watch data suggests low hydration. Time to drink some water.",
            sound: false,
          },
          trigger: null,
        });
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }

      return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

export const WATCH_INTERVALS = [0, 1, 2, 3, 4, 6, 8, 12, 24] as const;
export type WatchInterval = (typeof WATCH_INTERVALS)[number];

export function useWatchMonitor() {
  const [watchInterval, setWatchIntervalState] = useState<WatchInterval>(0);

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

  const setWatchInterval = useCallback(async (hours: WatchInterval) => {
    if (Platform.OS === "web") return;
    setWatchIntervalState(hours);
    await AsyncStorage.setItem(INTERVAL_KEY, String(hours)).catch(() => {});

    if (hours === 0) {
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
        if (isRegistered) await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
      } catch {}
    } else {
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
        if (isRegistered) {
          await BackgroundFetch.setMinimumIntervalAsync(hours * 60 * 60).catch(() => {});
        } else {
          await BackgroundFetch.registerTaskAsync(TASK_NAME, {
            minimumInterval: hours * 60 * 60,
            stopOnTerminate: false,
            startOnBoot: true,
          });
        }
      } catch {}
    }
  }, []);

  return { watchInterval, setWatchInterval };
}
