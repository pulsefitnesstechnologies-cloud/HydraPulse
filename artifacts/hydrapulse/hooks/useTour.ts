import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const TOUR_KEY = "@hydrapulse:tourCompleted";

export interface TourHook {
  tourCompleted: boolean;
  tourLoaded: boolean;
  completeTour: () => Promise<void>;
  resetTour: () => Promise<void>;
}

export function useTour(): TourHook {
  const [tourCompleted, setTourCompleted] = useState(false);
  const [tourLoaded, setTourLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(TOUR_KEY)
      .then((raw) => {
        setTourCompleted(raw === "true");
      })
      .catch(() => {})
      .finally(() => setTourLoaded(true));
  }, []);

  const completeTour = useCallback(async () => {
    setTourCompleted(true);
    await AsyncStorage.setItem(TOUR_KEY, "true").catch(() => {});
  }, []);

  const resetTour = useCallback(async () => {
    setTourCompleted(false);
    await AsyncStorage.removeItem(TOUR_KEY).catch(() => {});
  }, []);

  return { tourCompleted, tourLoaded, completeTour, resetTour };
}
