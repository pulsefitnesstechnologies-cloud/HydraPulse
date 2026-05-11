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
export type ScanMethod = "phone" | "simulation";

export interface ScanRecord {
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
  isPremium: boolean;
  hasOnboarded: boolean;
  scanMode: ScanMethod;
  addScanResult: (record: ScanRecord) => void;
  clearHistory: () => void;
  setIsPremium: (val: boolean) => void;
  setHasOnboarded: (val: boolean) => void;
  setScanMode: (mode: ScanMethod) => void;
}

const FREE_SCANS_PER_WEEK = 5;

const STORAGE_KEYS = {
  HISTORY: "@hydrapulse:history",
  PREMIUM: "@hydrapulse:premium",
  ONBOARDED: "@hydrapulse:onboarded",
  SCAN_MODE: "@hydrapulse:scanMode",
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

const HydrationContext = createContext<HydrationContextType | undefined>(
  undefined
);

export function HydrationProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [isPremium, setIsPremiumState] = useState(false);
  const [hasOnboarded, setHasOnboardedState] = useState(false);
  const [scanMode, setScanModeState] = useState<ScanMethod>("simulation");

  useEffect(() => {
    (async () => {
      try {
        const [historyRaw, premiumRaw, onboardedRaw, modeRaw] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.HISTORY),
            AsyncStorage.getItem(STORAGE_KEYS.PREMIUM),
            AsyncStorage.getItem(STORAGE_KEYS.ONBOARDED),
            AsyncStorage.getItem(STORAGE_KEYS.SCAN_MODE),
          ]);
        if (historyRaw) setHistory(JSON.parse(historyRaw));
        if (premiumRaw === "true") setIsPremiumState(true);
        if (onboardedRaw === "true") setHasOnboardedState(true);
        if (modeRaw === "phone" || modeRaw === "simulation")
          setScanModeState(modeRaw);
      } catch {}
    })();
  }, []);

  const addScanResult = useCallback(
    async (record: ScanRecord) => {
      const updated = [record, ...history];
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

  const setScanMode = useCallback(async (mode: ScanMethod) => {
    setScanModeState(mode);
    await AsyncStorage.setItem(STORAGE_KEYS.SCAN_MODE, mode).catch(() => {});
  }, []);

  const weekStart = getStartOfWeek();
  const scansThisWeek = history.filter(
    (r) => new Date(r.date) >= weekStart
  ).length;

  const latestScan = history.length > 0 ? history[0] : null;

  return (
    <HydrationContext.Provider
      value={{
        history,
        latestScan,
        scansThisWeek,
        isPremium,
        hasOnboarded,
        scanMode,
        addScanResult,
        clearHistory,
        setIsPremium,
        setHasOnboarded,
        setScanMode,
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
