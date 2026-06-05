import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import { ScanRecord } from "@/context/HydrationContext";
import { WaterLog } from "@/context/WaterIntakeContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const NUDGE_ID          = "hydrapulse-smart-nudge";
const ENABLED_KEY       = "@hydrapulse:nudgeEnabled";
const COOLDOWN_KEY      = "@hydrapulse:lastNudgeMs";
const WINDOW_START_KEY  = "@hydrapulse:nudgeWindowStart";
const WINDOW_END_KEY    = "@hydrapulse:nudgeWindowEnd";

export const DEFAULT_WINDOW_START = 7;             // 7 AM default
export const DEFAULT_WINDOW_END   = 21;            // 9 PM default

const GAP_WEEKDAY_MS    = 3 * 60 * 60 * 1000;     // 3 h gap on weekdays
const GAP_WEEKEND_MS    = 3.5 * 60 * 60 * 1000;   // 3.5 h gap on weekends (looser)
const COOLDOWN_MS       = 60 * 60 * 1000;          // min 1 h between nudges
const GOAL_BEHIND_RATIO = 0.5;                     // "behind" = < 50% of daily goal

// ─── Contextual message picker ────────────────────────────────────────────────
//
// Two triggers can combine: gap (no activity for N hours) and goal deficit
// (behind on daily water goal after 6 PM). Messages are tuned per condition
// and time-of-day so they feel like a coach rather than a nag.

function pickMessage(
  hour24: number,
  gapHours: number,
  goalProgress: number, // 0–1
  isWeekend: boolean,
): { title: string; body: string } {
  const behindOnGoal =
    goalProgress < GOAL_BEHIND_RATIO && hour24 >= 18;

  // Both conditions: behind on goal AND a meaningful gap
  if (behindOnGoal && gapHours >= 2) {
    const pct = Math.round(goalProgress * 100);
    return {
      title: "Hydration check",
      body: `You're at ${pct}% of your daily goal and haven't logged anything in ${Math.round(gapHours)} hours. Time to catch up.`,
    };
  }

  // Goal deficit only (gap within threshold but still behind)
  if (behindOnGoal) {
    const pct = Math.round(goalProgress * 100);
    return {
      title: "Goal reminder",
      body: `You're at ${pct}% of today's water goal. A few more glasses before bed makes a big difference.`,
    };
  }

  // Gap only — tone varies by time of day and weekend
  if (hour24 < 12) {
    return {
      title: "Morning hydration",
      body: "Start your day strong — a glass of water now sets the tone for steady hydration.",
    };
  }
  if (hour24 < 15) {
    return {
      title: "Afternoon check-in",
      body: "It's been a while since your last log. A glass of water now keeps your energy and focus up.",
    };
  }
  if (hour24 < 18) {
    return {
      title: "Mid-afternoon reminder",
      body: "Staying ahead of thirst is easier than catching up. Time for a quick drink.",
    };
  }
  return {
    title: "Evening check-in",
    body: isWeekend
      ? "Winding down for the evening? Hydrating before bed improves overnight recovery."
      : "End-of-day reminder — a glass or two now helps your body recover while you sleep.",
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface SmartNudgeHook {
  nudgeEnabled: boolean;
  nudgeWindowStart: number; // hour24, e.g. 7 = 7 AM
  nudgeWindowEnd: number;   // hour24, e.g. 21 = 9 PM
  setNudgeEnabled: (on: boolean) => Promise<void>;
  setNudgeWindow: (startHour24: number, endHour24: number) => Promise<void>;
}

export function useSmartNudge({
  waterLog,
  history,
  todayTotalOz,
  dailyGoalOz,
  hasPermission,
}: {
  waterLog: WaterLog[];
  history: ScanRecord[];
  todayTotalOz: number;
  dailyGoalOz: number;
  hasPermission: boolean;
}): SmartNudgeHook {
  const [nudgeEnabled, setNudgeEnabledState] = useState(false);
  const [nudgeWindowStart, setWindowStartState] = useState(DEFAULT_WINDOW_START);
  const [nudgeWindowEnd, setWindowEndState]     = useState(DEFAULT_WINDOW_END);

  // Refs so the AppState callback always sees the latest values without
  // needing to re-register the listener every time state changes.
  const enabledRef     = useRef(false);
  const windowStartRef = useRef(DEFAULT_WINDOW_START);
  const windowEndRef   = useRef(DEFAULT_WINDOW_END);

  // Stable ref for all data that changes frequently — avoids stale closures
  // in tryNudge without making it unstable via useCallback deps.
  const latestRef = useRef({
    waterLog,
    history,
    todayTotalOz,
    dailyGoalOz,
    hasPermission,
  });
  useEffect(() => {
    latestRef.current = { waterLog, history, todayTotalOz, dailyGoalOz, hasPermission };
  });

  // Load persisted state on mount
  useEffect(() => {
    if (Platform.OS === "web") return;
    Promise.all([
      AsyncStorage.getItem(ENABLED_KEY),
      AsyncStorage.getItem(WINDOW_START_KEY),
      AsyncStorage.getItem(WINDOW_END_KEY),
    ]).then(([enabledRaw, startRaw, endRaw]) => {
      const on    = enabledRaw === "true";
      const start = startRaw !== null ? Number(startRaw) : DEFAULT_WINDOW_START;
      const end   = endRaw   !== null ? Number(endRaw)   : DEFAULT_WINDOW_END;
      enabledRef.current     = on;
      windowStartRef.current = isNaN(start) ? DEFAULT_WINDOW_START : start;
      windowEndRef.current   = isNaN(end)   ? DEFAULT_WINDOW_END   : end;
      setNudgeEnabledState(on);
      setWindowStartState(windowStartRef.current);
      setWindowEndState(windowEndRef.current);
    }).catch(() => {});
  }, []);

  const setNudgeEnabled = useCallback(async (on: boolean) => {
    enabledRef.current = on;
    setNudgeEnabledState(on);
    await AsyncStorage.setItem(ENABLED_KEY, on ? "true" : "false").catch(() => {});
    if (!on) {
      // Cancel any pending nudge so the user isn't surprised after turning off.
      await Notifications.cancelScheduledNotificationAsync(NUDGE_ID).catch(() => {});
    }
  }, []);

  const setNudgeWindow = useCallback(async (startHour24: number, endHour24: number) => {
    windowStartRef.current = startHour24;
    windowEndRef.current   = endHour24;
    setWindowStartState(startHour24);
    setWindowEndState(endHour24);
    await Promise.all([
      AsyncStorage.setItem(WINDOW_START_KEY, String(startHour24)),
      AsyncStorage.setItem(WINDOW_END_KEY,   String(endHour24)),
    ]).catch(() => {});
  }, []);

  // Core logic — called on every app foreground transition.
  const tryNudge = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (!enabledRef.current) return;

    const { waterLog, history, todayTotalOz, dailyGoalOz, hasPermission } =
      latestRef.current;
    if (!hasPermission) return;

    // ── Active-window gate (user-configurable) ──
    const now = new Date();
    const hour24 = now.getHours();
    const winStart = windowStartRef.current;
    const winEnd   = windowEndRef.current;
    // Support windows that cross midnight (e.g. 10 PM–6 AM) by checking
    // whether start > end, meaning the window wraps around.
    const inWindow = winStart <= winEnd
      ? hour24 >= winStart && hour24 < winEnd
      : hour24 >= winStart || hour24 < winEnd;
    if (!inWindow) return;

    // ── Cooldown gate: don't fire more than once per hour ──
    const lastRaw = await AsyncStorage.getItem(COOLDOWN_KEY).catch(() => null);
    if (lastRaw) {
      const lastMs = Number(lastRaw);
      if (!isNaN(lastMs) && Date.now() - lastMs < COOLDOWN_MS) return;
    }

    // ── Last-activity timestamp ──
    const lastWaterMs =
      waterLog.length > 0
        ? Math.max(...waterLog.map((l) => new Date(l.time).getTime()))
        : 0;
    const lastScanMs =
      history.length > 0
        ? Math.max(...history.map((s) => new Date(s.date).getTime()))
        : 0;
    const lastActivityMs = Math.max(lastWaterMs, lastScanMs);

    // ── Gap check ──
    const day = now.getDay();
    const isWeekend = day === 0 || day === 6;
    const gapThresholdMs = isWeekend ? GAP_WEEKEND_MS : GAP_WEEKDAY_MS;
    const gapMs = lastActivityMs > 0 ? Date.now() - lastActivityMs : Infinity;

    // ── Goal check: applies in the last portion of the user's active window,
    //    but only if that window extends into evening (end hour > 18).
    //    Anchored to 6 PM minimum so goal nudges always feel contextually
    //    appropriate regardless of how the window is configured.
    const goalCheckHour = Math.max(18, winEnd - 3);
    const goalProgress = dailyGoalOz > 0 ? todayTotalOz / dailyGoalOz : 1;
    const behindOnGoal =
      goalProgress < GOAL_BEHIND_RATIO && hour24 >= goalCheckHour && winEnd > 18;

    // Fire only when at least one condition is met
    if (gapMs < gapThresholdMs && !behindOnGoal) return;

    const gapH = gapMs / (60 * 60 * 1000);
    const { title, body } = pickMessage(hour24, gapH, goalProgress, isWeekend);

    // Deterministic ID — replaces any earlier nudge still in the tray.
    await Notifications.scheduleNotificationAsync({
      identifier: NUDGE_ID,
      content: {
        title,
        body,
        sound: "default",
        interruptionLevel: "active",
        data: { type: "smart-nudge" },
      },
      trigger: null, // immediate
    }).catch(() => {});

    // Record cooldown timestamp
    await AsyncStorage.setItem(COOLDOWN_KEY, String(Date.now())).catch(() => {});
  }, []); // stable — reads via latestRef and enabledRef

  // Listen for app foreground transitions
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") tryNudge();
    });
    return () => sub.remove();
  }, [tryNudge]);

  return {
    nudgeEnabled,
    nudgeWindowStart,
    nudgeWindowEnd,
    setNudgeEnabled,
    setNudgeWindow,
  };
}
