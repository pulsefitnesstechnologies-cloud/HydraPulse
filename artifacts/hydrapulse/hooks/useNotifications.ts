import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScanAlarm {
  enabled: boolean;
  hour: number; // 1-12
  minute: number; // 0-59
  ampm: "AM" | "PM";
  notifId: string | null;
}

export interface SmartReminder {
  enabled: boolean;
  hour: number; // 1-12
  minute: number; // 0-59
  ampm: "AM" | "PM";
  message: string;
  notifId: string | null;
}

export type AlarmTuple = [ScanAlarm, ScanAlarm, ScanAlarm];
export type ReminderTuple = [SmartReminder, SmartReminder, SmartReminder];

export const DEFAULT_SCAN_ALARM: ScanAlarm = {
  enabled: false,
  hour: 8,
  minute: 0,
  ampm: "AM",
  notifId: null,
};

export const DEFAULT_SMART_REMINDER: SmartReminder = {
  enabled: false,
  hour: 8,
  minute: 0,
  ampm: "AM",
  message: "",
  notifId: null,
};

// ─── Storage keys ─────────────────────────────────────────────────────────────

const SCAN_ALARMS_KEY = "@hydrapulse:scanAlarms";
const SMART_REMINDERS_KEY = "@hydrapulse:smartReminders";

// ─── Deterministic notification identifiers ───────────────────────────────────
// Using fixed slot IDs means scheduling a slot always replaces the existing
// notification — it is physically impossible to accumulate duplicates.

export function scanAlarmId(index: number) {
  return `hydrapulse-scan-alarm-${index}`;
}
export function smartReminderId(index: number) {
  return `hydrapulse-smart-reminder-${index}`;
}
export const SCAN_RESULT_ID = "hydrapulse-scan-result";

// ─── Notification handler (set once at module level) ─────────────────────────
// Controls behaviour when a notification arrives while the app is FOREGROUND.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function to24h(hour: number, ampm: "AM" | "PM"): number {
  if (ampm === "AM" && hour === 12) return 0;
  if (ampm === "PM" && hour !== 12) return hour + 12;
  return hour;
}

async function scheduleScanAlarm(alarm: ScanAlarm, index: number): Promise<string | null> {
  const identifier = scanAlarmId(index);
  // Always cancel first — with a deterministic ID this is instant and safe.
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
  if (!alarm.enabled || Platform.OS === "web") return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: "Hydration Scan",
        body: "Time for your scheduled hydration check. Open HydraPulse to scan now.",
        sound: "default",
        interruptionLevel: "timeSensitive",
        data: { type: "scan-alarm" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: to24h(alarm.hour, alarm.ampm),
        minute: alarm.minute,
      },
    });
  } catch {
    return null;
  }
}

async function scheduleSmartReminder(reminder: SmartReminder, index: number): Promise<string | null> {
  const identifier = smartReminderId(index);
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
  if (!reminder.enabled || !reminder.message.trim() || Platform.OS === "web") return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: "HydraPulse Reminder",
        body: reminder.message.trim(),
        sound: "default",
        interruptionLevel: "timeSensitive",
        data: { type: "smart-reminder" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: to24h(reminder.hour, reminder.ampm),
        minute: reminder.minute,
      },
    });
  } catch {
    return null;
  }
}

// ─── Default state ────────────────────────────────────────────────────────────

const DEFAULT_ALARMS: AlarmTuple = [
  { ...DEFAULT_SCAN_ALARM, hour: 8, ampm: "AM" },
  { ...DEFAULT_SCAN_ALARM, hour: 12, ampm: "PM" },
  { ...DEFAULT_SCAN_ALARM, hour: 6, ampm: "PM" },
];

const DEFAULT_REMINDERS: ReminderTuple = [
  { ...DEFAULT_SMART_REMINDER, hour: 8, ampm: "AM" },
  { ...DEFAULT_SMART_REMINDER, hour: 12, ampm: "PM" },
  { ...DEFAULT_SMART_REMINDER, hour: 6, ampm: "PM" },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const [hasPermission, setHasPermission] = useState(false);
  const [scanAlarms, setScanAlarms] = useState<AlarmTuple>(DEFAULT_ALARMS);
  const [smartReminders, setSmartReminders] = useState<ReminderTuple>(DEFAULT_REMINDERS);

  // Refs so callbacks always see latest state without stale closures.
  // Critical for parallel calls (e.g. doSchedule calling all 3 reminder
  // slots simultaneously) — each read from the ref sees the committed value,
  // not a snapshot captured at callback-creation time.
  const scanAlarmsRef = useRef(scanAlarms);
  const smartRemindersRef = useRef(smartReminders);
  useEffect(() => { scanAlarmsRef.current = scanAlarms; }, [scanAlarms]);
  useEffect(() => { smartRemindersRef.current = smartReminders; }, [smartReminders]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      const [permResult, alarmsRaw, remindersRaw] = await Promise.all([
        Notifications.getPermissionsAsync(),
        AsyncStorage.getItem(SCAN_ALARMS_KEY),
        AsyncStorage.getItem(SMART_REMINDERS_KEY),
      ]).catch(() => [null, null, null] as const);

      if (permResult && "status" in permResult) {
        const granted = permResult.status === "granted";
        setHasPermission(granted);
      }
      if (alarmsRaw) setScanAlarms(JSON.parse(alarmsRaw) as AlarmTuple);
      if (remindersRaw) setSmartReminders(JSON.parse(remindersRaw) as ReminderTuple);
    })();
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") return false;
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowProvisional: false,
      },
    });
    const granted = status === "granted";
    setHasPermission(granted);
    return granted;
  }, []);

  const updateScanAlarm = useCallback(
    async (index: 0 | 1 | 2, partial: Partial<ScanAlarm>) => {
      // Read from ref so parallel calls each see the current committed state.
      const updated = [...scanAlarmsRef.current] as AlarmTuple;
      const next = { ...updated[index], ...partial };
      next.notifId = await scheduleScanAlarm(next, index);
      updated[index] = next;
      setScanAlarms(updated);
      scanAlarmsRef.current = updated;
      await AsyncStorage.setItem(SCAN_ALARMS_KEY, JSON.stringify(updated)).catch(() => {});
    },
    [] // no state deps — reads via ref
  );

  const updateSmartReminder = useCallback(
    async (index: 0 | 1 | 2, partial: Partial<SmartReminder>) => {
      const updated = [...smartRemindersRef.current] as ReminderTuple;
      const next = { ...updated[index], ...partial };
      next.notifId = await scheduleSmartReminder(next, index);
      updated[index] = next;
      setSmartReminders(updated);
      smartRemindersRef.current = updated;
      await AsyncStorage.setItem(SMART_REMINDERS_KEY, JSON.stringify(updated)).catch(() => {});
    },
    [] // no state deps — reads via ref
  );

  const sendScanResultNotification = useCallback(
    async (score: number, hr: number | null, label: string) => {
      if (!hasPermission || Platform.OS === "web") return;
      const hrPart = hr ? ` · HR ${hr} BPM` : "";
      // Use a deterministic ID so a new result always replaces the previous
      // one — tapping the notification navigates to History.
      await Notifications.scheduleNotificationAsync({
        identifier: SCAN_RESULT_ID,
        content: {
          title: `Hydration: ${label}`,
          body: `Score ${score}/4${hrPart} — tap to view your result`,
          sound: "default",
          interruptionLevel: "timeSensitive",
          data: { type: "scan-result" },
        },
        trigger: null,
      }).catch(() => {});
    },
    [hasPermission]
  );

  const cancelAll = useCallback(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  }, []);

  return {
    hasPermission,
    scanAlarms,
    smartReminders,
    requestPermission,
    updateScanAlarm,
    updateSmartReminder,
    sendScanResultNotification,
    cancelAll,
  };
}
