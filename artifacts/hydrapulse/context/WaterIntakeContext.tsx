import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";

import { effectiveOz } from "@/constants/liquidTypes";

export interface WaterLog {
  id: string;
  amountOz: number;     // raw amount entered by the user
  liquidType?: string;  // liquid type id (e.g. "water", "coffee") — defaults to "water"
  time: string;         // ISO date
}

interface WaterIntakeContextType {
  waterLog: WaterLog[];
  todayTotalOz: number;   // effective hydration oz (raw × liquid factor)
  dailyGoalOz: number;
  setDailyGoalOz: (oz: number) => Promise<void>;
  addWaterLog: (entry: { amountOz: number; liquidType?: string; time: string }) => Promise<void>;
  deleteWaterLog: (id: string) => Promise<void>;
  clearWaterLog: () => Promise<void>;
}

const STORAGE_KEY = "@hydrapulse:waterLog";
const GOAL_KEY = "@hydrapulse:dailyGoalOz";
const DEFAULT_GOAL_OZ = 64;

const WaterIntakeContext = createContext<WaterIntakeContextType | undefined>(undefined);

export function WaterIntakeProvider({ children }: { children: React.ReactNode }) {
  const [waterLog, setWaterLog] = useState<WaterLog[]>([]);
  const [dailyGoalOzState, setDailyGoalOzState] = useState(DEFAULT_GOAL_OZ);

  // dateKey refreshes whenever the calendar day changes (midnight local time).
  // Including it in the todayTotalOz memo ensures the goal resets at midnight
  // even if the water log hasn't changed and the app stays open.
  const [dateKey, setDateKey] = useState(() => new Date().toDateString());

  useEffect(() => {
    // Refresh on foreground — catches midnight crossings while app was backgrounded.
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") setDateKey(new Date().toDateString());
    });
    // Also poll once per minute so the reset happens promptly if the app is open.
    const tick = setInterval(() => {
      setDateKey(new Date().toDateString());
    }, 60_000);
    return () => {
      appStateSub.remove();
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => { if (raw) setWaterLog(JSON.parse(raw)); })
      .catch(() => {});
    AsyncStorage.getItem(GOAL_KEY)
      .then((raw) => { if (raw) setDailyGoalOzState(Number(raw)); })
      .catch(() => {});
  }, []);

  const save = useCallback(async (log: WaterLog[]) => {
    setWaterLog(log);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(log)).catch(() => {});
  }, []);

  const addWaterLog = useCallback(
    async (entry: { amountOz: number; liquidType?: string; time: string }) => {
      const record: WaterLog = {
        id: `water-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        amountOz: entry.amountOz,
        liquidType: entry.liquidType ?? "water",
        time: entry.time,
      };
      await save([record, ...waterLog]);
    },
    [waterLog, save]
  );

  const deleteWaterLog = useCallback(
    async (id: string) => {
      await save(waterLog.filter((e) => e.id !== id));
    },
    [waterLog, save]
  );

  const setDailyGoalOz = useCallback(async (oz: number) => {
    setDailyGoalOzState(oz);
    await AsyncStorage.setItem(GOAL_KEY, String(oz)).catch(() => {});
  }, []);

  const clearWaterLog = useCallback(async () => {
    setWaterLog([]);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  // todayTotalOz accounts for each liquid's hydration factor so that, e.g.,
  // 8 fl oz of coffee (factor 0.7) contributes only 5.6 oz toward the goal.
  const todayTotalOz = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return waterLog
      .filter((e) => new Date(e.time) >= todayStart)
      .reduce((s, e) => s + effectiveOz(e.amountOz, e.liquidType), 0);
  // dateKey changes at midnight (local time) so the filter recomputes even
  // when waterLog is unchanged — this is what resets the goal at midnight.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waterLog, dateKey]);

  return (
    <WaterIntakeContext.Provider
      value={{
        waterLog,
        todayTotalOz,
        dailyGoalOz: dailyGoalOzState,
        setDailyGoalOz,
        addWaterLog,
        deleteWaterLog,
        clearWaterLog,
      }}
    >
      {children}
    </WaterIntakeContext.Provider>
  );
}

export function useWaterIntake() {
  const ctx = useContext(WaterIntakeContext);
  if (!ctx) throw new Error("useWaterIntake must be used within WaterIntakeProvider");
  return ctx;
}
