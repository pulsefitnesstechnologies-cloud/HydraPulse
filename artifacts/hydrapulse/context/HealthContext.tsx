import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Alert, Platform } from "react-native";

import { ScanRecord, getScoreLabel, useHydration } from "@/context/HydrationContext";
import { useWaterIntake } from "@/context/WaterIntakeContext";
import { HealthSnapshot, useHealthKit } from "@/hooks/useHealthKit";
import {
  AlarmTuple,
  ReminderTuple,
  ScanAlarm,
  SmartReminder,
  useNotifications,
} from "@/hooks/useNotifications";
import {
  SmartScheduleHook,
  SmartScheduleTime,
  useSmartSchedule,
} from "@/hooks/useSmartSchedule";
import {
  AlertThreshold,
  estimateHydrationFromMetrics,
  useWatchMonitor,
} from "@/hooks/useWatchMonitor";

const HEALTH_ENABLED_KEY = "@hydrapulse:healthEnabled";

// ─── Watch confidence ─────────────────────────────────────────────────────────
//
// Confidence improves with both the data richness (HR+HRV vs HR-only) and the
// number of samples that were averaged together. Apple Watch records HR every
// 5-15 min at rest, so a 3-hour window typically yields 8-20 samples.
//
// Formula:
//   base   — depends on which signals are available (HR+HRV is most reliable)
//   bonus  — each additional sample up to 18 adds a small increment
//   max    — hard cap at 96 (acknowledges inherent wrist-PPG limitations)
//
function sampleConfidence(hr: number | null, hrv: number | null, sampleCount: number): number {
  const base = hr !== null && hrv !== null ? 80 : hr !== null ? 64 : 52;
  const bonus = Math.min(sampleCount, 18) * 0.9; // up to +16.2 for 18+ samples
  return Math.min(Math.round(base + bonus), 96);
}

function buildWatchRecord(snap: HealthSnapshot): ScanRecord | null {
  const score = estimateHydrationFromMetrics(
    snap.heartRate,
    snap.hrv,
    snap.baselineRestingHR,
    snap.baselineHRV,
  );
  if (score === null) return null;
  return {
    id: `watch-${Date.now()}`,
    date: new Date().toISOString(),
    score,
    label: getScoreLabel(score),
    method: "watch",
    confidence: sampleConfidence(snap.heartRate, snap.hrv, snap.sampleCount),
    heartRate: snap.heartRate ?? undefined,
    hrv: snap.hrv ?? undefined,
    liveHeartRate: snap.liveHeartRate ?? undefined,
  };
}

// ─── Context type ─────────────────────────────────────────────────────────────

interface HealthContextType {
  healthKitAvailable: boolean;
  healthKitEnabled: boolean;
  healthSnapshot: HealthSnapshot;
  healthLoading: boolean;
  notificationPermission: boolean;
  scanAlarms: AlarmTuple;
  smartReminders: ReminderTuple;
  alertThreshold: AlertThreshold;
  // Smart schedule
  smartScheduleEnabled: boolean;
  smartScheduledTimes: SmartScheduleTime[];
  lastScheduledDate: string | null;
  isScheduling: boolean;
  enableSmartSchedule: () => Promise<void>;
  disableSmartSchedule: () => Promise<void>;
  refreshSmartSchedule: () => Promise<void>;
  hasEnoughData: boolean;
  pendingSuggestions: SmartScheduleTime[];
  suggestionDismissed: boolean;
  dismissSuggestion: () => Promise<void>;
  connectHealthKit: () => Promise<{ ok: boolean; error?: string }>;
  refreshHealthData: () => void;
  runWatchScan: () => Promise<ScanRecord | "not-worn" | null>;
  requestNotificationPermission: () => Promise<boolean>;
  updateScanAlarm: (index: 0 | 1 | 2, partial: Partial<ScanAlarm>) => Promise<void>;
  updateSmartReminder: (index: 0 | 1 | 2, partial: Partial<SmartReminder>) => Promise<void>;
  setAlertThreshold: (v: AlertThreshold) => Promise<void>;
  disableAllNotifications: () => Promise<void>;
  writeWaterLog: (oz: number, date: string) => Promise<boolean>;
}

const HealthContext = createContext<HealthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const { addScanResult, history } = useHydration();
  const { waterLog } = useWaterIntake();
  const hk = useHealthKit();
  const notif = useNotifications();
  const [healthKitEnabled, setHealthKitEnabled] = useState(false);

  // Apple Watch background HR monitoring fires every 10–30 min during rest.
  // 20 min was too tight — normal resting gaps were triggering false warnings.
  // 60 min is the practical floor: no reading for a full hour reliably means
  // the Watch was removed, not just that the user was sitting still.
  const NOT_WORN_THRESHOLD_MS = 60 * 60 * 1000;

  // Auto-scan callback passed to useWatchMonitor for time-based alarm triggers
  const onAutoScan = useCallback(async (): Promise<number | null> => {
    if (Platform.OS !== "ios") return null;
    const snap = await hk.fetchLatest();
    if (!snap || (snap.heartRate === null && snap.hrv === null)) return null;

    // Require a fresh live sample — same guard as manual Watch scan
    if (
      snap.mostRecentSampleMs === null ||
      Date.now() - snap.mostRecentSampleMs > NOT_WORN_THRESHOLD_MS
    ) {
      return null; // Watch not worn — skip saving, no score
    }

    const record = buildWatchRecord(snap);
    if (!record) return null;
    await addScanResult(record);

    // Show an in-app alert so the score is immediately visible
    const hrLine = record.heartRate ? `\nResting Heart Rate: ${record.heartRate}` : "";
    const hrvLine = record.hrv ? `  ·  HRV: ${record.hrv} ms` : "";
    Alert.alert(
      "Scheduled Scan Complete",
      `Hydration Score: ${record.score}/4 — ${record.label}${hrLine}${hrvLine}`,
      [{ text: "OK" }]
    );

    return record.score;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hk.fetchLatest, addScanResult, notif.sendScanResultNotification]);

  const monitor = useWatchMonitor({
    onAutoScan,
    scanAlarms: notif.scanAlarms,
  });

  const smartSchedule = useSmartSchedule({
    waterLog,
    history,
    updateSmartReminder: notif.updateSmartReminder,
    hasPermission: notif.hasPermission,
    scanAlarms: notif.scanAlarms,
  });

  // Restore health connection on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HEALTH_ENABLED_KEY);
        if (raw === "true") {
          setHealthKitEnabled(true);
          hk.requestAuthorization();
        }
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectHealthKit = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const result = await hk.requestAuthorization();
    if (result.ok) {
      setHealthKitEnabled(true);
      await AsyncStorage.setItem(HEALTH_ENABLED_KEY, "true").catch(() => {});
    }
    return result;
  }, [hk]);

  const runWatchScan = useCallback(async (): Promise<ScanRecord | "not-worn" | null> => {
    if (Platform.OS !== "ios") return null;

    // Read the always-current ref (not the React state) so this stable callback
    // never has a stale false-negative from a closed-over isAuthorized value.
    // The ref is updated synchronously inside requestAuthorization, so even if
    // this fires immediately after auth completes the ref will be true.
    if (!hk.isAuthorizedRef.current) {
      const authResult = await hk.requestAuthorization();
      if (!authResult.ok) return null;
    }

    const snap = await hk.fetchLatest();

    // No data at all from HealthKit — permissions missing or Watch never paired.
    if (!snap || (snap.heartRate === null && snap.hrv === null)) return "not-worn";

    // For manual scans we do NOT gate on mostRecentSampleMs. Live HR sampling
    // frequency drops to every 10–30 min during rest, so a gap > 60 min is
    // normal and does not mean the Watch is off. Scoring uses Resting HR
    // (Apple's daily computation), which is valid regardless of when the last
    // live sample was taken. The timestamp gate is kept only for auto-scans
    // where we genuinely need a recent live reading to confirm the Watch is on.
    const record = buildWatchRecord(snap);
    if (!record) return "not-worn";
    addScanResult(record);
    return record;
  }, [hk.fetchLatest, addScanResult]);

  const disableAllNotifications = useCallback(async () => {
    await notif.cancelAll();
  }, [notif]);

  const writeWaterLog = useCallback(async (oz: number, dateStr: string): Promise<boolean> => {
    if (Platform.OS !== "ios") return false;
    return hk.writeWater(oz, new Date(dateStr));
  }, [hk]);

  return (
    <HealthContext.Provider
      value={{
        healthKitAvailable: hk.isAvailable,
        healthKitEnabled: healthKitEnabled,
        healthSnapshot: hk.snapshot,
        healthLoading: hk.isLoading,
        notificationPermission: notif.hasPermission,
        scanAlarms: notif.scanAlarms,
        smartReminders: notif.smartReminders,
        alertThreshold: monitor.alertThreshold,
        // Smart schedule
        smartScheduleEnabled: smartSchedule.smartScheduleEnabled,
        smartScheduledTimes: smartSchedule.smartScheduledTimes,
        lastScheduledDate: smartSchedule.lastScheduledDate,
        isScheduling: smartSchedule.isScheduling,
        enableSmartSchedule: smartSchedule.enableSmartSchedule,
        disableSmartSchedule: smartSchedule.disableSmartSchedule,
        refreshSmartSchedule: smartSchedule.refreshSmartSchedule,
        hasEnoughData: smartSchedule.hasEnoughData,
        pendingSuggestions: smartSchedule.pendingSuggestions,
        suggestionDismissed: smartSchedule.suggestionDismissed,
        dismissSuggestion: smartSchedule.dismissSuggestion,
        connectHealthKit,
        refreshHealthData: () => { hk.fetchLatest(); },
        runWatchScan,
        requestNotificationPermission: notif.requestPermission,
        updateScanAlarm: notif.updateScanAlarm,
        updateSmartReminder: notif.updateSmartReminder,
        setAlertThreshold: monitor.setAlertThreshold,
        disableAllNotifications,
        writeWaterLog,
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
