import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface WaterLog {
  id: string;
  amountOz: number;
  time: string; // ISO date
}

interface WaterIntakeContextType {
  waterLog: WaterLog[];
  todayTotalOz: number;
  dailyGoalOz: number;
  setDailyGoalOz: (oz: number) => Promise<void>;
  addWaterLog: (entry: { amountOz: number; time: string }) => Promise<void>;
  deleteWaterLog: (id: string) => Promise<void>;
  clearWaterLog: () => Promise<void>;
}

const STORAGE_KEY = "@hydrapulse:waterLog";
const GOAL_KEY = "@hydrapulse:dailyGoalOz";
const DEFAULT_GOAL_OZ = 64;

const WaterIntakeContext = createContext<WaterIntakeContextType | undefined>(undefined);

export function WaterIntakeProvider({ children }: { children: React.ReactNode }) {
  const [waterLog, setWaterLog] = useState<WaterLog[]>([]);
  const [dailyGoalOz, setDailyGoalOzState] = useState(DEFAULT_GOAL_OZ);

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
    async (entry: { amountOz: number; time: string }) => {
      const record: WaterLog = {
        id: `water-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        amountOz: entry.amountOz,
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

  const todayTotalOz = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return waterLog
      .filter((e) => new Date(e.time) >= todayStart)
      .reduce((s, e) => s + e.amountOz, 0);
  }, [waterLog]);

  return (
    <WaterIntakeContext.Provider
      value={{ waterLog, todayTotalOz, dailyGoalOz, setDailyGoalOz, addWaterLog, deleteWaterLog, clearWaterLog }}
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
