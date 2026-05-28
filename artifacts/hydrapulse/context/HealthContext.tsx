import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Alert, Platform } from "react-native";

import { ScanRecord, getScoreLabel, useHydration } from "@/context/HydrationContext";
import { HealthSnapshot, useHealthKit } from "@/hooks/useHealthKit";
import {
  AlarmTuple,
  ReminderTuple,
  ScanAlarm,
  SmartReminder,
  useNotifications,
} from "@/hooks/useNotifications";
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
  connectHealthKit: () => Promise<{ ok: boolean; error?: string }>;
  refreshHealthData: () => void;
  runWatchScan: () => Promise<ScanRecord | "not-worn" | null>;
  requestNotificationPermission: () => Promise<boolean>;
  updateScanAlarm: (index: 0 | 1 | 2, partial: Partial<ScanAlarm>) => Promise<void>;
  updateSmartReminder: (index: 0 | 1 | 2, partial: Partial<SmartReminder>) => Promise<void>;
  setAlertThreshold: (v: AlertThreshold) => Promise<void>;
  disableAllNotifications: () => Promise<void>;
}

const HealthContext = createContext<HealthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const { addScanResult } = useHydration();
  const hk = useHealthKit();
  const notif = useNotifications();
  const [healthKitEnabled, setHealthKitEnabled] = useState(false);

  // Apple Watch records live HR every 5-15 min when worn. A 20-min gap
  // reliably indicates the Watch was removed (15 min was occasionally too
  // tight when the user was completely still for an extended period).
  const NOT_WORN_THRESHOLD_MS = 20 * 60 * 1000;

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
    const hrLine = record.heartRate ? `\nHR: ${record.heartRate} BPM` : "";
    const hrvLine = record.hrv ? `  ·  HRV: ${record.hrv} ms` : "";
    Alert.alert(
      "Scheduled Scan Complete",
      `Hydration Score: ${record.score}/4 — ${record.label}${hrLine}${hrvLine}`,
      [{ text: "OK" }]
    );

    // Also send a result notification for when the phone is locked / Watch only
    await notif.sendScanResultNotification(record.score, record.heartRate ?? null, record.label);
    return record.score;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hk.fetchLatest, addScanResult, notif.sendScanResultNotification]);

  const monitor = useWatchMonitor({
    onAutoScan,
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
    const snap = await hk.fetchLatest();
    if (!snap || (snap.heartRate === null && snap.hrv === null)) return null;

    if (
      snap.mostRecentSampleMs === null ||
      Date.now() - snap.mostRecentSampleMs > NOT_WORN_THRESHOLD_MS
    ) {
      return "not-worn";
    }

    const record = buildWatchRecord(snap);
    if (!record) return null;
    addScanResult(record);
    return record;
  }, [hk.fetchLatest, addScanResult]);

  const disableAllNotifications = useCallback(async () => {
    await notif.cancelAll();
  }, [notif]);

  return (
    <HealthContext.Provider
      value={{
        healthKitAvailable: hk.isAvailable,
        healthKitEnabled: healthKitEnabled && hk.isAuthorized,
        healthSnapshot: hk.snapshot,
        healthLoading: hk.isLoading,
        notificationPermission: notif.hasPermission,
        scanAlarms: notif.scanAlarms,
        smartReminders: notif.smartReminders,
        alertThreshold: monitor.alertThreshold,
        connectHealthKit,
        refreshHealthData: () => { hk.fetchLatest(); },
        runWatchScan,
        requestNotificationPermission: notif.requestPermission,
        updateScanAlarm: notif.updateScanAlarm,
        updateSmartReminder: notif.updateSmartReminder,
        setAlertThreshold: monitor.setAlertThreshold,
        disableAllNotifications,
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
