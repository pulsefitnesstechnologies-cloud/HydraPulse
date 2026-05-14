import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface WorkoutRecord {
  id: string;
  startDate: string;
  endDate: string | null;
  startWeightLbs: number;
  endWeightLbs: number | null;
  startHydrationScore: number | null;
  endHydrationScore: number | null;
  sweatLossLbs: number | null;
  sweatLossOz: number | null;
  durationMinutes: number | null;
}

interface WorkoutContextType {
  workouts: WorkoutRecord[];
  activeWorkout: WorkoutRecord | null;
  startWorkout: (weightLbs: number, hydrationScore?: number | null) => WorkoutRecord;
  endWorkout: (weightLbs: number, hydrationScore?: number | null) => WorkoutRecord;
  clearWorkouts: () => void;
}

const STORAGE_KEY = "@hydrapulse:workouts";

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setWorkouts(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  const persist = useCallback(async (updated: WorkoutRecord[]) => {
    setWorkouts(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
  }, []);

  const activeWorkout = workouts.find((w) => w.endDate === null) ?? null;

  const startWorkout = useCallback(
    (weightLbs: number, hydrationScore: number | null = null): WorkoutRecord => {
      const record: WorkoutRecord = {
        id: Date.now().toString(),
        startDate: new Date().toISOString(),
        endDate: null,
        startWeightLbs: weightLbs,
        endWeightLbs: null,
        startHydrationScore: hydrationScore,
        endHydrationScore: null,
        sweatLossLbs: null,
        sweatLossOz: null,
        durationMinutes: null,
      };
      persist([record, ...workouts.filter((w) => w.endDate !== null)]);
      return record;
    },
    [workouts, persist]
  );

  const endWorkout = useCallback(
    (weightLbs: number, hydrationScore: number | null = null): WorkoutRecord => {
      if (!activeWorkout) throw new Error("No active workout");
      const durationMinutes = Math.round(
        (Date.now() - new Date(activeWorkout.startDate).getTime()) / 60000
      );
      const sweatLossLbs = Math.max(0, activeWorkout.startWeightLbs - weightLbs);
      const finished: WorkoutRecord = {
        ...activeWorkout,
        endDate: new Date().toISOString(),
        endWeightLbs: weightLbs,
        endHydrationScore: hydrationScore,
        sweatLossLbs,
        sweatLossOz: parseFloat((sweatLossLbs * 16).toFixed(1)),
        durationMinutes,
      };
      const updated = workouts.map((w) => (w.id === finished.id ? finished : w));
      persist(updated);
      return finished;
    },
    [activeWorkout, workouts, persist]
  );

  const clearWorkouts = useCallback(async () => {
    setWorkouts([]);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return (
    <WorkoutContext.Provider
      value={{ workouts, activeWorkout, startWorkout, endWorkout, clearWorkouts }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error("useWorkout must be used within WorkoutProvider");
  return ctx;
}
