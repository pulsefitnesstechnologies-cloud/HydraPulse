import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { WaterFact, getTodaysFact } from "@/data/waterFacts";

const LAST_SHOWN_KEY = "@hydrapulse:dailyFactLastShown";

export interface DailyFactHook {
  visible: boolean;
  fact: WaterFact | null;
  dismiss: () => Promise<void>;
}

export function useDailyFact(): DailyFactHook {
  const [visible, setVisible] = useState(false);
  const [fact, setFact] = useState<WaterFact | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      try {
        const lastShown = await AsyncStorage.getItem(LAST_SHOWN_KEY);
        const today = new Date().toDateString();
        if (lastShown !== today) {
          setFact(getTodaysFact());
          setVisible(true);
        }
      } catch {}
    })();
  }, []);

  const dismiss = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(LAST_SHOWN_KEY, new Date().toDateString());
    } catch {}
  };

  return { visible, fact, dismiss };
}
