import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ScanRecord } from "@/context/HydrationContext";
import { WaterLog } from "@/context/WaterIntakeContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TipCategory = "Insight" | "Goal" | "Science" | "Habit" | "Progress";

export interface CoachTip {
  date: string;    // ISO date string (day only, e.g. "2026-05-30")
  category: TipCategory;
  title: string;
  body: string;
}

export interface WeeklyProgress {
  avgScoreThisWeek: number | null;
  avgScoreLastWeek: number | null;
  scoreDelta: number | null;
  scansThisWeek: number;
  waterLogsThisWeek: number;
  avgHrvThisWeek: number | null;
  avgHrvLastWeek: number | null;
  hrvDelta: number | null;
  bestScoreThisWeek: number | null;
  currentStreak: number;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const TIP_HISTORY_KEY = "@hydrapulse:coachTipHistory";
const MAX_TIP_HISTORY = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function computeStreak(history: ScanRecord[]): number {
  if (history.length === 0) return 0;
  const sorted = [...history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const days = new Set(sorted.map((s) => new Date(s.date).toDateString()));
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = daysAgo(i);
    if (days.has(d.toDateString())) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

// ─── Tip generation ───────────────────────────────────────────────────────────

function generateTip(
  history: ScanRecord[],
  waterLog: WaterLog[],
  progress: WeeklyProgress
): Omit<CoachTip, "date"> {
  const latest = history[0] ?? null;

  // 1 — Critical: last scan was very low
  if (latest && latest.score === 1) {
    return {
      category: "Insight",
      title: "Your hydration needs attention",
      body: "Your most recent scan showed a Critical hydration level. Try to drink 8–12 oz of water now and aim to log another scan within the next few hours.",
    };
  }

  // 2 — HRV improvement
  if (progress.hrvDelta !== null && progress.hrvDelta >= 8) {
    return {
      category: "Progress",
      title: `HRV up ${Math.round(progress.hrvDelta)} ms this week`,
      body: "Your heart rate variability has improved compared to last week — a sign your nervous system and hydration are in a better state. Keep your current water intake routine going.",
    };
  }

  // 3 — HRV decline
  if (progress.hrvDelta !== null && progress.hrvDelta <= -8) {
    return {
      category: "Insight",
      title: "HRV dipped this week",
      body: `Your HRV dropped about ${Math.abs(Math.round(progress.hrvDelta))} ms compared to last week. Fatigue, stress, or mild dehydration are common causes. Try to increase your water intake and log a scan today.`,
    };
  }

  // 4 — Score improving
  if (
    progress.scoreDelta !== null &&
    progress.scoreDelta >= 0.5 &&
    progress.avgScoreThisWeek !== null
  ) {
    return {
      category: "Progress",
      title: "Hydration trending up",
      body: `Your average hydration score this week is ${progress.avgScoreThisWeek.toFixed(1)}/4 — up ${progress.scoreDelta.toFixed(1)} from last week. Consistent water logging is paying off.`,
    };
  }

  // 5 — Score declining
  if (
    progress.scoreDelta !== null &&
    progress.scoreDelta <= -0.5 &&
    progress.avgScoreThisWeek !== null
  ) {
    return {
      category: "Insight",
      title: "Hydration score slipping",
      body: `This week's average score is ${progress.avgScoreThisWeek.toFixed(1)}/4, down ${Math.abs(progress.scoreDelta).toFixed(1)} from last week. Try to add one extra glass of water in the afternoon — that is typically the biggest gap.`,
    };
  }

  // 6 — Good streak
  if (progress.currentStreak >= 5) {
    return {
      category: "Goal",
      title: `${progress.currentStreak}-day scan streak`,
      body: "You have been scanning consistently — that is one of the best things you can do for long-term hydration awareness. Patterns become clearer the more data you build up.",
    };
  }

  // 7 — Low water logs this week
  if (progress.waterLogsThisWeek < 3 && progress.scansThisWeek >= 1) {
    return {
      category: "Habit",
      title: "Try logging your water intake",
      body: "Scan data is most accurate when paired with water logs. Try tapping the water icon on the home screen each time you drink — it only takes a second and helps the smart reminders learn your patterns faster.",
    };
  }

  // 8 — Excellent score
  if (latest && latest.score === 4) {
    return {
      category: "Progress",
      title: "Excellent hydration right now",
      body: "Your last scan showed Excellent hydration. To maintain this level, aim to drink small amounts consistently throughout the day rather than large amounts all at once.",
    };
  }

  // 9 — Rotating educational tips
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const scienceTips: Array<Omit<CoachTip, "date">> = [
    {
      category: "Science",
      title: "Why HRV reflects hydration",
      body: "Heart rate variability measures the variation between heartbeats. When you are dehydrated, blood volume drops and your heart works harder to maintain output, reducing HRV. Better hydration = steadier, more efficient heart rhythm.",
    },
    {
      category: "Science",
      title: "The 20-minute absorption window",
      body: "Water you drink takes about 20 minutes to reach your bloodstream. Drinking right before exercise or a scan may not fully show up yet — consistent intake throughout the day gives the most accurate readings.",
    },
    {
      category: "Habit",
      title: "Space it out for best results",
      body: "Drinking 8 oz every 1–2 hours is more effective than drinking 64 oz in one sitting. Your kidneys can only process about 1 liter per hour, so smaller, regular amounts hydrate your cells more effectively.",
    },
    {
      category: "Science",
      title: "Electrolytes matter too",
      body: "Water alone does not always rehydrate you optimally. Sodium, potassium, and magnesium help your cells hold onto water. After intense exercise or heat exposure, consider adding a pinch of salt or electrolyte drink to your water.",
    },
    {
      category: "Habit",
      title: "Morning hydration matters most",
      body: "After 7–8 hours of sleep without water, your body wakes up mildly dehydrated. Drinking 8–16 oz of water within 30 minutes of waking rehydrates your cells, kick-starts your metabolism, and sets a better baseline for the whole day.",
    },
  ];

  return scienceTips[dayOfYear % scienceTips.length];
}

// ─── Progress computation ─────────────────────────────────────────────────────

function computeProgress(
  history: ScanRecord[],
  waterLog: WaterLog[]
): WeeklyProgress {
  const thisWeekStart = daysAgo(7);
  const lastWeekStart = daysAgo(14);

  const thisWeekScans = history.filter((s) => new Date(s.date) >= thisWeekStart);
  const lastWeekScans = history.filter(
    (s) => new Date(s.date) >= lastWeekStart && new Date(s.date) < thisWeekStart
  );

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const thisScores = thisWeekScans.map((s) => s.score);
  const lastScores = lastWeekScans.map((s) => s.score);
  const avgThis = avg(thisScores);
  const avgLast = avg(lastScores);

  const thisHrvs = thisWeekScans.filter((s) => s.hrv != null).map((s) => s.hrv!);
  const lastHrvs = lastWeekScans.filter((s) => s.hrv != null).map((s) => s.hrv!);
  const avgHrvThis = avg(thisHrvs);
  const avgHrvLast = avg(lastHrvs);

  const thisWeekLogs = waterLog.filter((l) => new Date(l.time) >= thisWeekStart);

  return {
    avgScoreThisWeek: avgThis,
    avgScoreLastWeek: avgLast,
    scoreDelta: avgThis !== null && avgLast !== null ? avgThis - avgLast : null,
    scansThisWeek: thisWeekScans.length,
    waterLogsThisWeek: thisWeekLogs.length,
    avgHrvThisWeek: avgHrvThis,
    avgHrvLastWeek: avgHrvLast,
    hrvDelta: avgHrvThis !== null && avgHrvLast !== null ? avgHrvThis - avgHrvLast : null,
    bestScoreThisWeek: thisScores.length ? Math.max(...thisScores) : null,
    currentStreak: computeStreak(history),
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface CoachHook {
  todaysTip: CoachTip | null;
  tipHistory: CoachTip[];
  progress: WeeklyProgress;
  isLoading: boolean;
}

export function useCoach({
  history,
  waterLog,
}: {
  history: ScanRecord[];
  waterLog: WaterLog[];
}): CoachHook {
  const [tipHistory, setTipHistory] = useState<CoachTip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const progress = useMemo(
    () => computeProgress(history, waterLog),
    [history, waterLog]
  );

  const saveTodaysTip = useCallback(
    async (tip: CoachTip) => {
      try {
        const raw = await AsyncStorage.getItem(TIP_HISTORY_KEY);
        const existing: CoachTip[] = raw ? JSON.parse(raw) : [];
        const withoutToday = existing.filter((t) => t.date !== tip.date);
        const updated = [tip, ...withoutToday].slice(0, MAX_TIP_HISTORY);
        await AsyncStorage.setItem(TIP_HISTORY_KEY, JSON.stringify(updated));
        setTipHistory(updated);
      } catch {}
    },
    []
  );

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const raw = await AsyncStorage.getItem(TIP_HISTORY_KEY);
        const existing: CoachTip[] = raw ? JSON.parse(raw) : [];
        const today = todayKey();
        const alreadyToday = existing.find((t) => t.date === today);

        if (alreadyToday) {
          setTipHistory(existing);
        } else {
          const generated = generateTip(history, waterLog, progress);
          const newTip: CoachTip = { ...generated, date: today };
          await saveTodaysTip(newTip);
        }
      } catch {}
      setIsLoading(false);
    })();
  // Only regenerate when history or waterLog actually changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length, waterLog.length]);

  const todaysTip = useMemo(() => {
    const today = todayKey();
    return tipHistory.find((t) => t.date === today) ?? null;
  }, [tipHistory]);

  return { todaysTip, tipHistory, progress, isLoading };
}
