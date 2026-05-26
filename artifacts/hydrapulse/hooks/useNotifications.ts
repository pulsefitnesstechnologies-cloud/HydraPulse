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

// ─── Notification handler (set once at module level) ─────────────────────────
// Controls behaviour when a notification arrives while the app is FOREGROUND.
// Sound enabled so banners appear with audio both on iPhone and Apple Watch.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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

async function cancelNotif(id: string | null): Promise<void> {
  if (!id || Platform.OS === "web") return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

async function scheduleScanAlarm(alarm: ScanAlarm): Promise<string | null> {
  if (!alarm.enabled || Platform.OS === "web") return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: "Hydration Scan",
        body: "Time for your scheduled hydration check. Open HydraPulse to scan now.",
        // Use default system sound so the notification rings on both iPhone and Watch
        sound: "default",
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

async function scheduleSmartReminder(reminder: SmartReminder): Promise<string | null> {
  if (!reminder.enabled || !reminder.message.trim() || Platform.OS === "web") return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: "HydraPulse Reminder",
        body: reminder.message.trim(),
        sound: "default",
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
  const loadedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      const [permResult, alarmsRaw, remindersRaw] = await Promise.all([
        Notifications.getPermissionsAsync(),
        AsyncStorage.getItem(SCAN_ALARMS_KEY),
        AsyncStorage.getItem(SMART_REMINDERS_KEY),
      ]).catch(() => [null, null, null] as const);

      if (permResult && "status" in permResult) {
        setHasPermission(permResult.status === "granted");
      }
      if (alarmsRaw) setScanAlarms(JSON.parse(alarmsRaw) as AlarmTuple);
      if (remindersRaw) setSmartReminders(JSON.parse(remindersRaw) as ReminderTuple);
      loadedRef.current = true;
    })();
  }, []);

  /**
   * Request notification permissions. On iOS we explicitly ask for alerts,
   * sounds, and badges — this is required for notifications to appear on both
   * iPhone and Apple Watch. Without the sound permission the Watch will not
   * mirror the notification.
   */
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
      const updated = [...scanAlarms] as AlarmTuple;
      const current = updated[index];
      const next = { ...current, ...partial };

      await cancelNotif(current.notifId);
      next.notifId = await scheduleScanAlarm(next);
      updated[index] = next;

      setScanAlarms(updated);
      await AsyncStorage.setItem(SCAN_ALARMS_KEY, JSON.stringify(updated)).catch(() => {});
    },
    [scanAlarms]
  );

  const updateSmartReminder = useCallback(
    async (index: 0 | 1 | 2, partial: Partial<SmartReminder>) => {
      const updated = [...smartReminders] as ReminderTuple;
      const current = updated[index];
      const next = { ...current, ...partial };

      await cancelNotif(current.notifId);
      next.notifId = await scheduleSmartReminder(next);
      updated[index] = next;

      setSmartReminders(updated);
      await AsyncStorage.setItem(SMART_REMINDERS_KEY, JSON.stringify(updated)).catch(() => {});
    },
    [smartReminders]
  );

  const sendScanResultNotification = useCallback(
    async (score: number, hr: number | null, label: string) => {
      if (!hasPermission || Platform.OS === "web") return;
      const hrPart = hr ? ` · HR ${hr} BPM` : "";
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Hydration: ${label}`,
          body: `Score ${score}/4${hrPart}`,
          sound: "default",
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
