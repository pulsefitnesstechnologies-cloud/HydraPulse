import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

import { ScanRecord, getScoreLabel, useHydration } from "@/context/HydrationContext";
import { HealthSnapshot, useHealthKit } from "@/hooks/useHealthKit";
import { DEFAULT_SCHEDULE, ReminderSchedule, useNotifications } from "@/hooks/useNotifications";
import {
  AlertThreshold,
  WatchInterval,
  estimateHydrationFromMetrics,
  useWatchMonitor,
} from "@/hooks/useWatchMonitor";

const STORAGE_KEYS = {
  HEALTH_ENABLED: "@hydrapulse:healthEnabled",
  REMINDER_SCHEDULE: "@hydrapulse:reminderSchedule",
};

function buildWatchRecord(snap: HealthSnapshot): ScanRecord | null {
  const score = estimateHydrationFromMetrics(snap.heartRate, snap.hrv);
  if (score === null) return null;
  return {
    id: `watch-${Date.now()}`,
    date: new Date().toISOString(),
    score,
    label: getScoreLabel(score),
    method: "watch",
    confidence: snap.heartRate !== null && snap.hrv !== null ? 75 : 50,
    heartRate: snap.heartRate ?? undefined,
    hrv: snap.hrv ?? undefined,
  };
}

interface HealthContextType {
  healthKitAvailable: boolean;
  healthKitEnabled: boolean;
  healthSnapshot: HealthSnapshot;
  healthLoading: boolean;
  notificationsEnabled: boolean;
  reminderSchedule: ReminderSchedule;
  watchInterval: WatchInterval;
  alertThreshold: AlertThreshold;
  connectHealthKit: () => Promise<{ ok: boolean; error?: string }>;
  refreshHealthData: () => void;
  runWatchScan: () => Promise<ScanRecord | null>;
  notificationPermission: boolean;
  requestNotificationPermission: () => Promise<boolean>;
  updateReminderSchedule: (schedule: ReminderSchedule) => Promise<void>;
  disableNotifications: () => Promise<void>;
  setWatchInterval: (hours: WatchInterval) => Promise<void>;
  setAlertThreshold: (v: AlertThreshold) => Promise<void>;
}

const HealthContext = createContext<HealthContextType | undefined>(undefined);

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const { addScanResult } = useHydration();
  const hk = useHealthKit();
  const notif = useNotifications();

  const [healthKitEnabled, setHealthKitEnabled] = useState(false);
  const [reminderSchedule, setReminderSchedule] = useState<ReminderSchedule>(DEFAULT_SCHEDULE);

  // Auto-scan callback: fetch fresh Watch data, save a scan record, return the score
  const onAutoScan = useCallback(async (): Promise<number | null> => {
    if (Platform.OS !== "ios") return null;
    const snap = await hk.fetchLatest();
    if (!snap || (snap.heartRate === null && snap.hrv === null)) return null;
    const record = buildWatchRecord(snap);
    if (!record) return null;
    addScanResult(record);
    return record.score;
  }, [hk.fetchLatest, addScanResult]);

  const monitor = useWatchMonitor({ onAutoScan });

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

  const connectHealthKit = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const result = await hk.requestAuthorization();
    if (result.ok) {
      setHealthKitEnabled(true);
      await AsyncStorage.setItem(STORAGE_KEYS.HEALTH_ENABLED, "true").catch(() => {});
    }
    return result;
  }, [hk]);

  // Manual Watch scan: refresh HK, build a record, save it, return it
  const runWatchScan = useCallback(async (): Promise<ScanRecord | null> => {
    if (Platform.OS !== "ios") return null;
    const snap = await hk.fetchLatest();
    if (!snap || (snap.heartRate === null && snap.hrv === null)) return null;
    const record = buildWatchRecord(snap);
    if (!record) return null;
    addScanResult(record);
    return record;
  }, [hk.fetchLatest, addScanResult]);

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
        alertThreshold: monitor.alertThreshold,
        connectHealthKit,
        refreshHealthData: () => { hk.fetchLatest(); },
        runWatchScan,
        notificationPermission: notif.hasPermission,
        requestNotificationPermission: notif.requestPermission,
        updateReminderSchedule,
        disableNotifications,
        setWatchInterval: monitor.setWatchInterval,
        setAlertThreshold: monitor.setAlertThreshold,
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
