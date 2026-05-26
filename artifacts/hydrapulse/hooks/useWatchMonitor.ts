import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import { ScanAlarm } from "@/hooks/useNotifications";

// ─── Constants & types ────────────────────────────────────────────────────────

const ALERT_KEY = "@hydrapulse:alertThreshold";
const lastAlarmScanKey = (i: number) => `@hydrapulse:lastAlarmScanDate:${i}`;

// Consider an alarm "firing" within this many minutes after its scheduled time.
// Covers cases where the user opens the app shortly after the alarm notification.
const ALARM_WINDOW_MIN = 20;

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

// ─── Hydration estimate ───────────────────────────────────────────────────────

/**
 * Estimate hydration score (1-4) from averaged Apple Watch HR + HRV samples.
 * Averaged multi-sample inputs give more stable results than single readings.
 */
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function alarmToTodayMs(alarm: ScanAlarm): number {
  let h = alarm.hour;
  if (alarm.ampm === "AM" && h === 12) h = 0;
  else if (alarm.ampm === "PM" && h !== 12) h += 12;
  const d = new Date();
  d.setHours(h, alarm.minute, 0, 0);
  return d.getTime();
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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWatchMonitor(opts?: {
  onAutoScan?: () => Promise<number | null>;
  scanAlarms?: ScanAlarm[];
}) {
  const [alertThreshold, setAlertThresholdState] = useState<AlertThreshold>(0);

  const onAutoScanRef = useRef(opts?.onAutoScan);
  const scanAlarmsRef = useRef(opts?.scanAlarms ?? []);

  useEffect(() => { onAutoScanRef.current = opts?.onAutoScan; }, [opts?.onAutoScan]);
  useEffect(() => { scanAlarmsRef.current = opts?.scanAlarms ?? []; }, [opts?.scanAlarms]);

  // Load persisted alert threshold
  useEffect(() => {
    if (Platform.OS === "web") return;
    AsyncStorage.getItem(ALERT_KEY)
      .then((raw) => {
        if (!raw) return;
        const v = parseInt(raw, 10) as AlertThreshold;
        if ((ALERT_THRESHOLDS as readonly number[]).includes(v)) setAlertThresholdState(v);
      })
      .catch(() => {});
  }, []);

  // Time-based auto-scan: fires when app comes to foreground within ALARM_WINDOW_MIN
  // of any enabled scan alarm time. Each alarm can only fire once per calendar day.
  useEffect(() => {
    if (Platform.OS === "web") return;

    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;
      const alarms = scanAlarmsRef.current;
      if (!alarms.length) return;

      const nowMs = Date.now();
      const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      for (let i = 0; i < alarms.length; i++) {
        const alarm = alarms[i];
        if (!alarm.enabled) continue;

        const alarmMs = alarmToTodayMs(alarm);
        const diff = nowMs - alarmMs; // positive = alarm was in the past

        // Window: [0, ALARM_WINDOW_MIN] minutes after the alarm time
        if (diff < 0 || diff > ALARM_WINDOW_MIN * 60 * 1000) continue;

        // One scan per alarm per calendar day
        const lastDate = await AsyncStorage.getItem(lastAlarmScanKey(i)).catch(() => null);
        if (lastDate === todayStr) continue;

        const score = await onAutoScanRef.current?.();
        if (score != null) {
          await AsyncStorage.setItem(lastAlarmScanKey(i), todayStr).catch(() => {});
          if (alertThreshold > 0 && score <= alertThreshold) {
            await sendThresholdAlert(SCORE_LABELS[score] ?? "low");
          }
        }
        break; // only one auto-scan per foreground event
      }
    });

    return () => sub.remove();
  }, [alertThreshold]);

  const setAlertThreshold = useCallback(async (v: AlertThreshold) => {
    if (Platform.OS === "web") return;
    setAlertThresholdState(v);
    await AsyncStorage.setItem(ALERT_KEY, String(v)).catch(() => {});
  }, []);

  return { alertThreshold, setAlertThreshold };
}
