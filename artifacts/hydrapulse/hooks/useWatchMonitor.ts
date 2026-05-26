import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import { ScanAlarm } from "@/hooks/useNotifications";

// ─── Constants & types ────────────────────────────────────────────────────────

const ALERT_KEY = "@hydrapulse:alertThreshold";
const lastAlarmScanKey = (i: number) => `@hydrapulse:lastAlarmScanDate:${i}`;

// Consider an alarm "firing" within this many minutes after its scheduled time.
const ALARM_WINDOW_MIN = 20;

// Minimum milliseconds between two auto-scan handler runs (debounce).
// Prevents the OS from firing multiple rapid "active" AppState events for the
// same foreground transition from all triggering scans concurrently.
const HANDLER_DEBOUNCE_MS = 8000;

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
 *
 * Thresholds are calibrated against published literature on HR/HRV and
 * hydration status. They are intentionally wider than the camera-PPG thresholds
 * to account for the day-to-day natural variation in wrist-based optical HR and
 * SDNN HRV across individuals.
 *
 * When both HR and HRV are available the combination is much more reliable than
 * either alone; the score in that case reflects the weaker of the two signals
 * (conservative-safe approach).
 */
export function estimateHydrationFromMetrics(
  hr: number | null,
  hrv: number | null
): 1 | 2 | 3 | 4 | null {
  if (hr === null && hrv === null) return null;

  if (hr !== null && hrv !== null) {
    // Excellent: low resting HR + high HRV (parasympathetic dominance)
    if (hr <= 72 && hrv >= 50) return 4;
    // Good: healthy adult resting range
    if (hr <= 86 && hrv >= 28) return 3;
    // Low: mild dehydration markers
    if (hr <= 100 && hrv >= 14) return 2;
    return 1;
  }

  // HR only (no HRV available)
  if (hr !== null) {
    if (hr <= 75) return 3;
    if (hr <= 94) return 2;
    return 1;
  }

  // HRV only (rare — e.g. Watch not logging HR recently)
  const h = hrv as number;
  if (h >= 50) return 3;
  if (h >= 22) return 2;
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
        sound: "default",
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
  // Mutex: prevents concurrent auto-scan runs when the OS fires rapid AppState events
  const runningRef = useRef(false);
  // Debounce: track when the handler last ran to suppress sub-threshold re-fires
  const lastRunRef = useRef(0);

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

      // Debounce: skip if we ran less than HANDLER_DEBOUNCE_MS ago
      const now = Date.now();
      if (now - lastRunRef.current < HANDLER_DEBOUNCE_MS) return;

      // Mutex: skip if a previous invocation is still running
      if (runningRef.current) return;
      runningRef.current = true;
      lastRunRef.current = now;

      try {
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

          // Mark BEFORE running so any concurrent invocations (after mutex is
          // released) see that this alarm already fired today.
          await AsyncStorage.setItem(lastAlarmScanKey(i), todayStr).catch(() => {});

          const score = await onAutoScanRef.current?.();
          if (score != null && alertThreshold > 0 && score <= alertThreshold) {
            await sendThresholdAlert(SCORE_LABELS[score] ?? "low");
          }

          // Only one alarm fires per foreground event
          break;
        }
      } finally {
        runningRef.current = false;
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
