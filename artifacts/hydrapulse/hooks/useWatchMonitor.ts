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
  1: "Alert at Hydration 1",
  2: "Alert at Hydration 2",
  3: "Alert at Hydration 3",
};

// Full score names used in notifications and descriptions
export const SCORE_LEVEL_NAMES: Record<number, string> = {
  1: "Critical",
  2: "Low",
  3: "Good",
  4: "Excellent",
};

// ─── Hydration estimate ───────────────────────────────────────────────────────

/**
 * Estimate hydration score (1–4) from Apple Watch HR + HRV samples.
 *
 * PERSONALIZED MODE (preferred): when the user's personal 30-day baseline is
 * available, scoring is based on how much the current reading deviates from
 * their own norm — not a population average. This is far more accurate because
 * resting HR and HRV vary enormously between individuals. A resting HR of 78
 * is completely normal for one person and high for another.
 *
 * Physiological basis:
 *   • Dehydration reduces plasma volume → heart compensates by beating faster
 *     (elevated HR) and with less autonomic flexibility (suppressed HRV).
 *   • A 10–18% HR elevation above personal baseline corresponds roughly to
 *     1–2% body weight fluid loss (mild-moderate dehydration).
 *   • HRV suppression of 15–30% below baseline is a robust marker of the same.
 *
 * POPULATION FALLBACK: used on first launch before 30 days of resting-HR
 * history accumulates. Thresholds are intentionally wide to reduce false
 * positives across the normal population range.
 */
export function estimateHydrationFromMetrics(
  hr: number | null,
  hrv: number | null,
  baselineHR?: number | null,
  baselineHRV?: number | null,
): 1 | 2 | 3 | 4 | null {
  if (hr === null && hrv === null) return null;

  // ── Personalized scoring ─────────────────────────────────────────────────
  if (hr !== null && hrv !== null && baselineHR && baselineHRV) {
    // Positive hrDev  = HR elevated above personal baseline (dehydration signal)
    // Negative hrvDev = HRV suppressed below personal baseline (dehydration signal)
    const hrDev  = (hr  - baselineHR)  / baselineHR;
    const hrvDev = (hrv - baselineHRV) / baselineHRV;

    let hrScore: 1 | 2 | 3 | 4;
    if      (hrDev <= 0.04) hrScore = 4; // at/below baseline — well hydrated
    else if (hrDev <= 0.10) hrScore = 3; // ≤ 10% elevated — mild stress
    else if (hrDev <= 0.18) hrScore = 2; // 10–18% elevated — likely dehydrated
    else                    hrScore = 1; // > 18% — significant dehydration

    let hrvScore: 1 | 2 | 3 | 4;
    if      (hrvDev >= -0.06) hrvScore = 4; // within 6% of baseline — normal variation
    else if (hrvDev >= -0.17) hrvScore = 3; // 6–17% below — mild autonomic stress
    else if (hrvDev >= -0.30) hrvScore = 2; // 17–30% below — moderate suppression
    else                      hrvScore = 1; // > 30% below — significant suppression

    // Use the weaker of the two signals (conservative-safe)
    return Math.min(hrScore, hrvScore) as 1 | 2 | 3 | 4;
  }

  // HR only + personal HR baseline
  if (hr !== null && baselineHR && !hrv) {
    const hrDev = (hr - baselineHR) / baselineHR;
    if      (hrDev <= 0.05) return 3;
    else if (hrDev <= 0.16) return 2;
    return 1;
  }

  // ── Population-average fallback (no personal baseline yet) ───────────────
  if (hr !== null && hrv !== null) {
    if (hr <= 72 && hrv >= 50) return 4;
    if (hr <= 86 && hrv >= 28) return 3;
    if (hr <= 100 && hrv >= 14) return 2;
    return 1;
  }

  if (hr !== null) {
    if (hr <= 75) return 3;
    if (hr <= 94) return 2;
    return 1;
  }

  // HRV only (rare)
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

async function sendThresholdAlert(score: number): Promise<void> {
  const levelName = SCORE_LEVEL_NAMES[score] ?? "Low";
  const tips: Record<number, string> = {
    1: "Drink water immediately — your hydration is critically low.",
    2: "Your hydration has dropped. Drink some water soon.",
    3: "Your hydration level has dipped. Consider drinking some water.",
  };
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Hydration Level ${score} — ${levelName}`,
        body: tips[score] ?? "Your hydration level changed. Consider drinking some water.",
        sound: "default",
        interruptionLevel: "timeSensitive",
        data: { type: "hydration-alert", score },
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
            await sendThresholdAlert(score);
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
