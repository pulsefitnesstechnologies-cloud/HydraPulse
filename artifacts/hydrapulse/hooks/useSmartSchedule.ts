import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { ScanRecord } from "@/context/HydrationContext";
import { WaterLog } from "@/context/WaterIntakeContext";
import { ScanAlarm, SmartReminder } from "./useNotifications";

// ─── Storage ──────────────────────────────────────────────────────────────────

const ENABLED_KEY = "@hydrapulse:smartScheduleEnabled";
const DATE_KEY = "@hydrapulse:smartScheduleLastDate";
const DISMISSED_KEY = "@hydrapulse:smartScheduleSuggestionDismissed";

// ─── Algorithm constants ──────────────────────────────────────────────────────

const WAKING_START = 6;   // 6 AM — earliest a reminder fires
const WAKING_END = 22;    // 10 PM — latest a reminder fires
const MIN_EVENTS = 5;     // minimum events in last 14 days before pattern kicks in
const LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDisplay(hour24: number, minute: number): string {
  const ampm = hour24 >= 12 ? "PM" : "AM";
  let h = hour24 % 12;
  if (h === 0) h = 12;
  const m = String(minute).padStart(2, "0");
  return `${h}:${m} ${ampm}`;
}

function alarmTo24h(hour: number, ampm: "AM" | "PM"): number {
  if (ampm === "AM" && hour === 12) return 0;
  if (ampm === "PM" && hour !== 12) return hour + 12;
  return hour;
}

/** Shift a SmartScheduleTime forward by `minutes`, wrapping midnight. */
function shiftTime(t: SmartScheduleTime, minutes: number): SmartScheduleTime {
  const h24 = alarmTo24h(t.hour, t.ampm);
  const total = (h24 * 60 + t.minute + minutes) % (24 * 60);
  const newH24 = Math.floor(total / 60);
  const newMin = total % 60;
  const newAmpm: "AM" | "PM" = newH24 >= 12 ? "PM" : "AM";
  let newHour = newH24 % 12;
  if (newHour === 0) newHour = 12;
  return { ...t, hour: newHour, minute: newMin, ampm: newAmpm, displayTime: formatDisplay(newH24, newMin) };
}

/** Return a set of "H24:MM" keys for every enabled ScanAlarm. */
function enabledAlarmKeys(alarms: ScanAlarm[]): Set<string> {
  return new Set(
    alarms
      .filter((a) => a.enabled)
      .map((a) => `${alarmTo24h(a.hour, a.ampm)}:${String(a.minute).padStart(2, "0")}`)
  );
}

function messageForHour(hour24: number): string {
  if (hour24 < 12) return "Morning hydration check — a glass of water helps you start strong.";
  if (hour24 < 17) return "Afternoon reminder — staying hydrated keeps your energy up.";
  return "Evening check-in — hydrating before bed improves overnight recovery.";
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmartScheduleTime {
  hour: number;    // 1–12
  minute: number;
  ampm: "AM" | "PM";
  displayTime: string;
  message: string;
}

// ─── Core algorithm ───────────────────────────────────────────────────────────
//
// Divides the waking day into `count` equal segments. Within each segment,
// picks the hour with the fewest recorded drinking events — so the reminder
// lands in the user's natural gap rather than competing with an existing habit.
// Falls back to 9 AM / 1 PM / 6 PM when there's not enough history.

// Fallback times are intentionally offset from the ScanAlarm defaults (8 AM, 12 PM, 6 PM)
// to prevent a second notification landing at the same minute as a scheduled scan alarm.
const DEFAULTS: SmartScheduleTime[] = [
  { hour: 9,  minute: 0, ampm: "AM", displayTime: "9:00 AM",  message: messageForHour(9)  },
  { hour: 1,  minute: 0, ampm: "PM", displayTime: "1:00 PM",  message: messageForHour(13) },
  { hour: 7,  minute: 0, ampm: "PM", displayTime: "7:00 PM",  message: messageForHour(19) },
];

export function computeSmartTimes(
  events: { time: string }[],
  count = 3
): SmartScheduleTime[] {
  const cutoff = Date.now() - LOOKBACK_MS;
  const recentHours = events
    .filter((e) => new Date(e.time).getTime() > cutoff)
    .map((e) => new Date(e.time).getHours())
    .filter((h) => h >= WAKING_START && h < WAKING_END);

  if (recentHours.length < MIN_EVENTS) return DEFAULTS.slice(0, count);

  // Hourly frequency histogram
  const freq = new Array(24).fill(0) as number[];
  for (const h of recentHours) freq[h]++;

  // Divide waking window into equal segments; pick lowest-freq hour per segment
  const windowSize = (WAKING_END - WAKING_START) / count;
  const result: SmartScheduleTime[] = [];

  for (let i = 0; i < count; i++) {
    const segStart = Math.round(WAKING_START + i * windowSize);
    const segEnd   = Math.min(Math.round(WAKING_START + (i + 1) * windowSize), WAKING_END - 1);
    const midpoint = Math.round((segStart + segEnd) / 2);

    let bestHour = midpoint;
    let bestFreq = Infinity;
    for (let h = segStart; h <= segEnd; h++) {
      if (freq[h] < bestFreq) { bestFreq = freq[h]; bestHour = h; }
    }

    const ampm: "AM" | "PM" = bestHour >= 12 ? "PM" : "AM";
    let hour = bestHour % 12;
    if (hour === 0) hour = 12;
    result.push({
      hour,
      minute: 0,
      ampm,
      displayTime: formatDisplay(bestHour, 0),
      message: messageForHour(bestHour),
    });
  }

  return result;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface SmartScheduleHook {
  smartScheduleEnabled: boolean;
  smartScheduledTimes: SmartScheduleTime[];
  lastScheduledDate: string | null;
  isScheduling: boolean;
  enableSmartSchedule: () => Promise<void>;
  disableSmartSchedule: () => Promise<void>;
  refreshSmartSchedule: () => Promise<void>;
  /** True when there are enough events in the last 14 days to compute a real pattern. */
  hasEnoughData: boolean;
  /** The times the algorithm would suggest right now — always computed, regardless of enabled state. */
  pendingSuggestions: SmartScheduleTime[];
  /** True if the user has dismissed the suggestion card without enabling Auto-Schedule. */
  suggestionDismissed: boolean;
  /** Persist a dismissal so the suggestion card hides until data meaningfully changes. */
  dismissSuggestion: () => Promise<void>;
}

export function useSmartSchedule({
  waterLog,
  history,
  updateSmartReminder,
  hasPermission,
  scanAlarms,
}: {
  waterLog: WaterLog[];
  history: ScanRecord[];
  updateSmartReminder: (index: 0 | 1 | 2, partial: Partial<SmartReminder>) => Promise<void>;
  hasPermission: boolean;
  scanAlarms?: ScanAlarm[];
}): SmartScheduleHook {
  const [enabled, setEnabled] = useState(false);
  const [lastScheduledDate, setLastScheduledDate] = useState<string | null>(null);
  const [scheduledTimes, setScheduledTimes] = useState<SmartScheduleTime[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [ready, setReady] = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    if (Platform.OS === "web") { setReady(true); return; }
    (async () => {
      try {
        const [enabledRaw, dateRaw, dismissedRaw] = await Promise.all([
          AsyncStorage.getItem(ENABLED_KEY),
          AsyncStorage.getItem(DATE_KEY),
          AsyncStorage.getItem(DISMISSED_KEY),
        ]);
        if (enabledRaw === "true") setEnabled(true);
        if (dateRaw) setLastScheduledDate(dateRaw);
        if (dismissedRaw === "true") setSuggestionDismissed(true);
      } catch {}
      setReady(true);
    })();
  }, []);

  // Always-computed pattern analysis — drives the suggestion card regardless
  // of whether Auto-Schedule is enabled.
  const allEvents = useMemo(
    () => [
      ...waterLog.map((l) => ({ time: l.time })),
      ...history.map((s) => ({ time: s.date })),
    ],
    // Recompute only when counts change, not on every reference change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [waterLog.length, history.length]
  );

  const hasEnoughData = useMemo(() => {
    const cutoff = Date.now() - LOOKBACK_MS;
    const recentCount = allEvents.filter(
      (e) => new Date(e.time).getTime() > cutoff
    ).length;
    return recentCount >= MIN_EVENTS;
  }, [allEvents]);

  const pendingSuggestions = useMemo(
    () => computeSmartTimes(allEvents),
    [allEvents]
  );

  const dismissSuggestion = useCallback(async () => {
    setSuggestionDismissed(true);
    await AsyncStorage.setItem(DISMISSED_KEY, "true").catch(() => {});
  }, []);

  const doSchedule = useCallback(async () => {
    if (Platform.OS === "web") return;
    setIsScheduling(true);
    try {
      const events = [
        ...waterLog.map((l) => ({ time: l.time })),
        ...history.map((s) => ({ time: s.date })),
      ];
      const times = computeSmartTimes(events);

      // Avoid double-firing: if the algorithm picks a time that coincides with
      // an enabled ScanAlarm, shift the SmartReminder forward by 30 minutes.
      const alarmKeys = enabledAlarmKeys(scanAlarms ?? []);
      const adjustedTimes = times.map((t) => {
        const key = `${alarmTo24h(t.hour, t.ampm)}:${String(t.minute).padStart(2, "0")}`;
        return alarmKeys.has(key) ? shiftTime(t, 30) : t;
      });

      // Write all 3 slots (enabled only if notification permission is granted)
      await Promise.all(
        adjustedTimes.map((t, i) =>
          updateSmartReminder(i as 0 | 1 | 2, {
            enabled: hasPermission,
            hour: t.hour,
            minute: t.minute,
            ampm: t.ampm,
            message: t.message,
          })
        )
      );

      const now = new Date().toISOString();
      setScheduledTimes(adjustedTimes);
      setLastScheduledDate(now);
      await AsyncStorage.setItem(DATE_KEY, now).catch(() => {});
    } catch {}
    setIsScheduling(false);
  }, [waterLog, history, updateSmartReminder, hasPermission, scanAlarms]);

  // When storage is loaded and smart schedule is on, apply immediately.
  // This re-schedules on each app open so the pattern stays current.
  useEffect(() => {
    if (ready && enabled) doSchedule();
  // doSchedule identity changes when waterLog/history change — only run on
  // initial ready/enabled transition to avoid a loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, enabled]);

  const enable = useCallback(async () => {
    await AsyncStorage.setItem(ENABLED_KEY, "true").catch(() => {});
    setEnabled(true);
    await doSchedule();
  }, [doSchedule]);

  const disable = useCallback(async () => {
    await AsyncStorage.setItem(ENABLED_KEY, "false").catch(() => {});
    setEnabled(false);
    setScheduledTimes([]);
    await Promise.all(
      ([0, 1, 2] as const).map((i) =>
        updateSmartReminder(i, { enabled: false, message: "" })
      )
    ).catch(() => {});
  }, [updateSmartReminder]);

  return {
    smartScheduleEnabled: enabled,
    smartScheduledTimes: scheduledTimes,
    lastScheduledDate,
    isScheduling,
    enableSmartSchedule: enable,
    disableSmartSchedule: disable,
    refreshSmartSchedule: doSchedule,
    hasEnoughData,
    pendingSuggestions,
    suggestionDismissed,
    dismissSuggestion,
  };
}
