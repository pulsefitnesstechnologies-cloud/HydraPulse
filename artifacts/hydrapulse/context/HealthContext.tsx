import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { HealthSnapshot, useHealthKit } from "@/hooks/useHealthKit";
import { DEFAULT_SCHEDULE, ReminderSchedule, useNotifications } from "@/hooks/useNotifications";
import { WatchInterval, useWatchMonitor } from "@/hooks/useWatchMonitor";

const STORAGE_KEYS = {
  HEALTH_ENABLED: "@hydrapulse:healthEnabled",
  REMINDER_SCHEDULE: "@hydrapulse:reminderSchedule",
};

interface HealthContextType {
  healthKitAvailable: boolean;
  healthKitEnabled: boolean;
  healthSnapshot: HealthSnapshot;
  healthLoading: boolean;
  notificationsEnabled: boolean;
  reminderSchedule: ReminderSchedule;
  watchInterval: WatchInterval;
  connectHealthKit: () => Promise<boolean>;
  refreshHealthData: () => void;
  notificationPermission: boolean;
  requestNotificationPermission: () => Promise<boolean>;
  updateReminderSchedule: (schedule: ReminderSchedule) => Promise<void>;
  disableNotifications: () => Promise<void>;
  setWatchInterval: (hours: WatchInterval) => Promise<void>;
}

const HealthContext = createContext<HealthContextType | undefined>(undefined);

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const hk = useHealthKit();
  const notif = useNotifications();
  const monitor = useWatchMonitor();

  const [healthKitEnabled, setHealthKitEnabled] = useState(false);
  const [reminderSchedule, setReminderSchedule] = useState<ReminderSchedule>(DEFAULT_SCHEDULE);

  useEffect(() => {
    (async () => {
      try {
        const [healthRaw, scheduleRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.HEALTH_ENABLED),
          AsyncStorage.getItem(STORAGE_KEYS.REMINDER_SCHEDULE),
        ]);
        if (healthRaw === "true") {
          setHealthKitEnabled(true);
          hk.requestAuthorization();
        }
        if (scheduleRaw) {
          setReminderSchedule(JSON.parse(scheduleRaw));
        }
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectHealthKit = useCallback(async (): Promise<boolean> => {
    const ok = await hk.requestAuthorization();
    if (ok) {
      setHealthKitEnabled(true);
      await AsyncStorage.setItem(STORAGE_KEYS.HEALTH_ENABLED, "true").catch(() => {});
    }
    return ok;
  }, [hk]);

  const updateReminderSchedule = useCallback(
    async (schedule: ReminderSchedule) => {
      setReminderSchedule(schedule);
      await notif.scheduleReminders(schedule);
      await AsyncStorage.setItem(
        STORAGE_KEYS.REMINDER_SCHEDULE,
        JSON.stringify(schedule)
      ).catch(() => {});
    },
    [notif]
  );

  const disableNotifications = useCallback(async () => {
    await notif.cancelAll();
    const off = DEFAULT_SCHEDULE;
    setReminderSchedule(off);
    await AsyncStorage.setItem(
      STORAGE_KEYS.REMINDER_SCHEDULE,
      JSON.stringify(off)
    ).catch(() => {});
  }, [notif]);

  const notificationsEnabled =
    notif.hasPermission &&
    (reminderSchedule.morningEnabled ||
      reminderSchedule.afternoonEnabled ||
      reminderSchedule.eveningEnabled);

  return (
    <HealthContext.Provider
      value={{
        healthKitAvailable: hk.isAvailable,
        healthKitEnabled: healthKitEnabled && hk.isAuthorized,
        healthSnapshot: hk.snapshot,
        healthLoading: hk.isLoading,
        notificationsEnabled,
        reminderSchedule,
        watchInterval: monitor.watchInterval,
        connectHealthKit,
        refreshHealthData: hk.fetchLatest,
        notificationPermission: notif.hasPermission,
        requestNotificationPermission: notif.requestPermission,
        updateReminderSchedule,
        disableNotifications,
        setWatchInterval: monitor.setWatchInterval,
      }}
    >
      {children}
    </HealthContext.Provider>
  );
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error("useHealth must be used within HealthProvider");
  return ctx;
}
