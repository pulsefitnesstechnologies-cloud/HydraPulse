import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type HydrationScore = 1 | 2 | 3 | 4;
export type ScoreLabel = "Critical" | "Low" | "Good" | "Excellent";
// "simulation" retained for backwards compatibility with stored scan records
export type ScanMethod = "phone" | "simulation" | "watch";

export interface ScanRecord {
  /** Current live HR at scan time — display only, not used for hydration scoring. */
  liveHeartRate?: number;
  id: string;
  date: string;
  score: HydrationScore;
  label: ScoreLabel;
  notes?: string;
  method: ScanMethod;
  confidence: number;
  heartRate?: number;
  hrv?: number;
}

interface HydrationContextType {
  history: ScanRecord[];
  latestScan: ScanRecord | null;
  scansThisWeek: number;
  todayScans: number;
  currentStreak: number;
  bestStreak: number;
  isPremium: boolean;
  hasOnboarded: boolean;
  /** True once AsyncStorage has finished loading — NavigationGuard waits for this. */
  isLoaded: boolean;
  addScanResult: (record: ScanRecord) => void;
  removeScan: (id: string) => void;
  clearHistory: () => void;
  setIsPremium: (val: boolean) => void;
  setHasOnboarded: (val: boolean) => void;
}

// TESTING MODE: all features unlocked, no scan limits
const TESTING_MODE = true;
const FREE_SCANS_PER_WEEK = TESTING_MODE ? Infinity : 5;

const STORAGE_KEYS = {
  HISTORY: "@hydrapulse:history",
  PREMIUM: "@hydrapulse:premium",
  ONBOARDED: "@hydrapulse:onboarded",
  BEST_STREAK: "@hydrapulse:bestStreak",
};

export function getScoreLabel(score: HydrationScore): ScoreLabel {
  const labels: Record<HydrationScore, ScoreLabel> = {
    1: "Critical",
    2: "Low",
    3: "Good",
    4: "Excellent",
  };
  return labels[score];
}

export function getScoreColor(score: HydrationScore): string {
  const colors: Record<HydrationScore, string> = {
    1: "#EF4444",
    2: "#F97316",
    3: "#0EA5E9",
    4: "#10B981",
  };
  return colors[score];
}

function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  const start = new Date(now);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Count consecutive days ending on today (or yesterday if no scan today). */
function computeCurrentStreak(history: ScanRecord[]): number {
  if (history.length === 0) return 0;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const scanDays = new Set(history.map((r) => startOfDay(new Date(r.date))));
  const today = startOfDay(new Date());
  // If no scan today, streak can still be alive from yesterday —
  // only break if yesterday also has no scan.
  let cursor = scanDays.has(today) ? today : today - MS_PER_DAY;
  let streak = 0;
  while (scanDays.has(cursor)) {
    streak++;
    cursor -= MS_PER_DAY;
  }
  return streak;
}

function getTodayScans(history: ScanRecord[]): number {
  const today = startOfDay(new Date());
  return history.filter((r) => startOfDay(new Date(r.date)) === today).length;
}

const HydrationContext = createContext<HydrationContextType | undefined>(
  undefined
);

export function HydrationProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [isPremium, setIsPremiumState] = useState(TESTING_MODE);
  const [hasOnboarded, setHasOnboardedState] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [bestStreak, setBestStreakState] = useState(0);

  // historyRef always mirrors the latest history state so callbacks like
  // addScanResult never capture a stale snapshot via closure.
  const historyRef = React.useRef<ScanRecord[]>([]);
  useEffect(() => { historyRef.current = history; }, [history]);

  useEffect(() => {
    // Each key is loaded independently so a corrupted history value cannot
    // prevent the onboarded flag from being read (which would lock the user
    // out of the app with no way back in).
    (async () => {
      await AsyncStorage.getItem(STORAGE_KEYS.HISTORY)
        .then((raw) => {
          if (!raw) return;
          const parsed = JSON.parse(raw) as ScanRecord[];
          setHistory(parsed);
          historyRef.current = parsed;
        })
        .catch(() => {}); // corrupted history → keep empty array, never crash

      await AsyncStorage.getItem(STORAGE_KEYS.PREMIUM)
        .then((raw) => { if (raw === "true") setIsPremiumState(true); })
        .catch(() => {});

      await AsyncStorage.getItem(STORAGE_KEYS.BEST_STREAK)
        .then((raw) => { if (raw) setBestStreakState(parseInt(raw, 10) || 0); })
        .catch(() => {});

      // Read ONBOARDED and set both flags in the same synchronous block so
      // React 18 batches them into one render. This prevents NavigationGuard
      // from ever seeing isLoaded=true while hasOnboarded is still false.
      const onboardedRaw = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDED).catch(() => null);
      if (onboardedRaw === "true") setHasOnboardedState(true);
      setIsLoaded(true);
    })();
  }, []);

  // Stable callback — never re-created. Always reads the latest history from
  // historyRef rather than a potentially stale closure variable.
  const addScanResult = useCallback(async (record: ScanRecord) => {
    const updated = [record, ...historyRef.current];
    historyRef.current = updated;
    setHistory(updated);
    await AsyncStorage.setItem(
      STORAGE_KEYS.HISTORY,
      JSON.stringify(updated)
    ).catch(() => {});
  }, []);

  const removeScan = useCallback(
    async (id: string) => {
      const updated = history.filter((r) => r.id !== id);
      setHistory(updated);
      await AsyncStorage.setItem(
        STORAGE_KEYS.HISTORY,
        JSON.stringify(updated)
      ).catch(() => {});
    },
    [history]
  );

  const clearHistory = useCallback(async () => {
    setHistory([]);
    await AsyncStorage.removeItem(STORAGE_KEYS.HISTORY).catch(() => {});
  }, []);

  const setIsPremium = useCallback(async (val: boolean) => {
    setIsPremiumState(val);
    await AsyncStorage.setItem(
      STORAGE_KEYS.PREMIUM,
      val ? "true" : "false"
    ).catch(() => {});
  }, []);

  const setHasOnboarded = useCallback(async (val: boolean) => {
    setHasOnboardedState(val);
    await AsyncStorage.setItem(
      STORAGE_KEYS.ONBOARDED,
      val ? "true" : "false"
    ).catch(() => {});
  }, []);

  const weekStart = getStartOfWeek();
  const scansThisWeek = history.filter(
    (r) => new Date(r.date) >= weekStart
  ).length;

  const latestScan = history.length > 0 ? history[0] : null;
  const currentStreak = computeCurrentStreak(history);
  const todayScans = getTodayScans(history);

  // Persist best streak whenever current streak surpasses it.
  useEffect(() => {
    if (currentStreak > bestStreak) {
      setBestStreakState(currentStreak);
      AsyncStorage.setItem(STORAGE_KEYS.BEST_STREAK, String(currentStreak)).catch(() => {});
    }
  }, [currentStreak, bestStreak]);

  return (
    <HydrationContext.Provider
      value={{
        history,
        latestScan,
        scansThisWeek,
        todayScans,
        currentStreak,
        bestStreak: Math.max(bestStreak, currentStreak),
        isPremium,
        hasOnboarded,
        isLoaded,
        addScanResult,
        removeScan,
        clearHistory,
        setIsPremium,
        setHasOnboarded,
      }}
    >
      {children}
    </HydrationContext.Provider>
  );
}

export function useHydration() {
  const ctx = useContext(HydrationContext);
  if (!ctx) throw new Error("useHydration must be used within HydrationProvider");
  return ctx;
}

export { FREE_SCANS_PER_WEEK };
