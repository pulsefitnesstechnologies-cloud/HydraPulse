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

export interface StreakProtection {
  enabled: boolean;
  hour: number; // 1-12
  minute: number; // 0-59
  ampm: "AM" | "PM";
}

export interface QuietHours {
  enabled: boolean;
  startHour: number; // 0-23
  startMinute: number; // 0-59
  endHour: number; // 0-23
  endMinute: number; // 0-59
}

export type ReminderTone = "gentle" | "motivational" | "data-driven";
export type AlarmTuple = [ScanAlarm, ScanAlarm, ScanAlarm];
export type ReminderTuple = [SmartReminder, SmartReminder, SmartReminder];

// ─── Message template library ─────────────────────────────────────────────────
// Each tone has a pool of messages to draw from.
// "Apply in order" fills slots with the first three; "Shuffle" picks three at
// random so no two reminder slots feel repetitive over time.

export const REMINDER_TEMPLATES: Record<ReminderTone, string[]> = {
  gentle: [
    "Your body could use a drink right now.",
    "No water in a while — time for a quick sip?",
    "Let's keep the hydration flowing.",
    "A gentle nudge: have you had water recently?",
    "Small sip, big difference. Time to hydrate.",
    "Your body will thank you for a glass of water.",
    "Hydration check-in: How are you feeling?",
  ],
  motivational: [
    "Champions stay hydrated. Don't let dehydration slow you down.",
    "Keep your streak alive — drink up!",
    "Don't break the chain — drink up!",
    "Strong work lately. Let's keep it going.",
    "You're crushing your hydration — keep it up!",
    "Hydration fuels performance — time to drink up!",
    "Great job staying on top of it today.",
  ],
  "data-driven": [
    "HydraPulse tip: consistent hydration improves your HRV score.",
    "It's been over 3 hours — time for some water?",
    "Optimal hydration is 2-3 L daily. How are you tracking?",
    "Blood volume peaks when you are well hydrated — it shows in your scans.",
    "Your last scan showed room for improvement — drink now.",
    "Almost there! One good drink gets you closer to your goal.",
    "You're a bit behind today's goal — you got this.",
  ],
};

export const REMINDER_TONE_LABELS: Record<ReminderTone, string> = {
  gentle: "Gentle",
  motivational: "Motivational",
  "data-driven": "Data-driven",
};

/** Returns `count` unique messages picked at random from the given pool. */
function pickRandom(pool: string[], count: number): string[] {
  const copy = [...pool];
  const result: string[] = [];
  while (result.length < count && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

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

export const DEFAULT_STREAK_PROTECTION: StreakProtection = {
  enabled: false,
  hour: 7,
  minute: 0,
  ampm: "PM",
};

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  startHour: 22,
  startMinute: 0,
  endHour: 7,
  endMinute: 0,
};

// ─── Storage keys ─────────────────────────────────────────────────────────────

const SCAN_ALARMS_KEY = "@hydrapulse:scanAlarms";
const SMART_REMINDERS_KEY = "@hydrapulse:smartReminders";
const STREAK_PROTECTION_KEY = "@hydrapulse:streakProtection";
const QUIET_HOURS_KEY = "@hydrapulse:quietHours";
const REMINDER_TONE_KEY = "@hydrapulse:reminderTone";

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
export const STREAK_PROTECT_ID = "hydrapulse-streak-protect";
export const FOLLOW_UP_NUDGE_ID = "hydrapulse-follow-up-nudge";

// ─── Notification handler (set once at module level) ─────────────────────────

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

/**
 * Returns true if the given time (24-hour) falls inside the quiet-hours window.
 * Handles overnight windows (e.g. 22:00 – 07:00) correctly.
 */
export function isInQuietHours(h24: number, minute: number, qh: QuietHours): boolean {
  if (!qh.enabled) return false;
  const t = h24 * 60 + minute;
  const start = qh.startHour * 60 + qh.startMinute;
  const end = qh.endHour * 60 + qh.endMinute;
  if (start === end) return false;
  if (start < end) return t >= start && t < end; // same-day window
  return t >= start || t < end; // overnight window
}

export function formatHour24Display(h24: number, minute: number): string {
  const ampm = h24 >= 12 ? "PM" : "AM";
  let h = h24 % 12;
  if (h === 0) h = 12;
  const mm = minute.toString().padStart(2, "0");
  return `${h}:${mm} ${ampm}`;
}

// ─── Scheduling functions ─────────────────────────────────────────────────────

async function scheduleScanAlarm(alarm: ScanAlarm, index: number): Promise<string | null> {
  const identifier = scanAlarmId(index);
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

async function scheduleStreakProtectionNotif(sp: StreakProtection): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(STREAK_PROTECT_ID).catch(() => {});
  if (!sp.enabled || Platform.OS === "web") return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: STREAK_PROTECT_ID,
      content: {
        title: "Streak at Risk",
        body: "Don't break your streak — tap to run today's hydration scan.",
        sound: "default",
        interruptionLevel: "timeSensitive",
        data: { type: "streak-protection" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: to24h(sp.hour, sp.ampm),
        minute: sp.minute,
      },
    });
  } catch {
    // silently ignore
  }
}

const FOLLOW_UP_MESSAGES: Record<1 | 2, string> = {
  1: "Your hydration score was critical. Have you had water? Run a follow-up scan.",
  2: "Checking in: your hydration was low 90 minutes ago. Feeling more hydrated? Run a quick scan.",
};

// ─── Default state ────────────────────────────────────────────────────────────

const DEFAULT_ALARMS: AlarmTuple = [
  { ...DEFAULT_SCAN_ALARM, hour: 8, ampm: "AM" },
  { ...DEFAULT_SCAN_ALARM, hour: 12, ampm: "PM" },
  { ...DEFAULT_SCAN_ALARM, hour: 6, ampm: "PM" },
];

const DEFAULT_REMINDERS: ReminderTuple = [
  { ...DEFAULT_SMART_REMINDER, hour: 9, ampm: "AM" },
  { ...DEFAULT_SMART_REMINDER, hour: 1, ampm: "PM" },
  { ...DEFAULT_SMART_REMINDER, hour: 7, ampm: "PM" },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const [hasPermission, setHasPermission] = useState(false);
  const [scanAlarms, setScanAlarms] = useState<AlarmTuple>(DEFAULT_ALARMS);
  const [smartReminders, setSmartReminders] = useState<ReminderTuple>(DEFAULT_REMINDERS);
  const [streakProtection, setStreakProtection] = useState<StreakProtection>(DEFAULT_STREAK_PROTECTION);
  const [quietHours, setQuietHours] = useState<QuietHours>(DEFAULT_QUIET_HOURS);
  const [reminderTone, setReminderToneState] = useState<ReminderTone>("gentle");

  // Refs so callbacks always see latest state without stale closures.
  const scanAlarmsRef = useRef(scanAlarms);
  const smartRemindersRef = useRef(smartReminders);
  const streakProtectionRef = useRef(streakProtection);
  const quietHoursRef = useRef(quietHours);
  useEffect(() => { scanAlarmsRef.current = scanAlarms; }, [scanAlarms]);
  useEffect(() => { smartRemindersRef.current = smartReminders; }, [smartReminders]);
  useEffect(() => { streakProtectionRef.current = streakProtection; }, [streakProtection]);
  useEffect(() => { quietHoursRef.current = quietHours; }, [quietHours]);

  // ── Load from storage and reschedule on mount ──────────────────────────────
  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      const [permResult, alarmsRaw, remindersRaw, spRaw, qhRaw, toneRaw] = await Promise.all([
        Notifications.getPermissionsAsync(),
        AsyncStorage.getItem(SCAN_ALARMS_KEY),
        AsyncStorage.getItem(SMART_REMINDERS_KEY),
        AsyncStorage.getItem(STREAK_PROTECTION_KEY),
        AsyncStorage.getItem(QUIET_HOURS_KEY),
        AsyncStorage.getItem(REMINDER_TONE_KEY),
      ]).catch(() => [null, null, null, null, null, null] as const);

      const loadedAlarms: AlarmTuple = alarmsRaw
        ? (JSON.parse(alarmsRaw) as AlarmTuple)
        : DEFAULT_ALARMS;
      const loadedReminders: ReminderTuple = remindersRaw
        ? (JSON.parse(remindersRaw) as ReminderTuple)
        : DEFAULT_REMINDERS;
      const loadedSP: StreakProtection = spRaw
        ? (JSON.parse(spRaw) as StreakProtection)
        : DEFAULT_STREAK_PROTECTION;
      const loadedQH: QuietHours = qhRaw
        ? (JSON.parse(qhRaw) as QuietHours)
        : DEFAULT_QUIET_HOURS;
      const loadedTone: ReminderTone = toneRaw
        ? (toneRaw as ReminderTone)
        : "gentle";

      // Cancel ALL scheduled notifications before rescheduling.
      await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});

      const [updatedAlarms, updatedReminders] = await Promise.all([
        Promise.all(
          loadedAlarms.map(async (alarm, i) => ({
            ...alarm,
            notifId: await scheduleScanAlarm(alarm, i),
          }))
        ),
        Promise.all(
          loadedReminders.map(async (reminder, i) => ({
            ...reminder,
            notifId: await scheduleSmartReminder(reminder, i),
          }))
        ),
        scheduleStreakProtectionNotif(loadedSP),
      ]);

      if (permResult && "status" in permResult) {
        setHasPermission(permResult.status === "granted");
      }
      setScanAlarms(updatedAlarms as AlarmTuple);
      scanAlarmsRef.current = updatedAlarms as AlarmTuple;
      setSmartReminders(updatedReminders as ReminderTuple);
      smartRemindersRef.current = updatedReminders as ReminderTuple;
      setStreakProtection(loadedSP);
      streakProtectionRef.current = loadedSP;
      setQuietHours(loadedQH);
      quietHoursRef.current = loadedQH;
      setReminderToneState(loadedTone);
    })();
  }, []);

  // ── Permission ─────────────────────────────────────────────────────────────
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

  // ── Scan alarms ────────────────────────────────────────────────────────────
  const updateScanAlarm = useCallback(
    async (index: 0 | 1 | 2, partial: Partial<ScanAlarm>) => {
      const updated = [...scanAlarmsRef.current] as AlarmTuple;
      const next = { ...updated[index], ...partial };
      next.notifId = await scheduleScanAlarm(next, index);
      updated[index] = next;
      setScanAlarms(updated);
      scanAlarmsRef.current = updated;
      await AsyncStorage.setItem(SCAN_ALARMS_KEY, JSON.stringify(updated)).catch(() => {});
    },
    []
  );

  // ── Smart reminders ────────────────────────────────────────────────────────
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
    []
  );

  // ── Streak protection ──────────────────────────────────────────────────────
  const updateStreakProtection = useCallback(
    async (partial: Partial<StreakProtection>) => {
      const next = { ...streakProtectionRef.current, ...partial };
      await scheduleStreakProtectionNotif(next);
      setStreakProtection(next);
      streakProtectionRef.current = next;
      await AsyncStorage.setItem(STREAK_PROTECTION_KEY, JSON.stringify(next)).catch(() => {});
    },
    []
  );

  const cancelStreakProtection = useCallback(async () => {
    await Notifications.cancelScheduledNotificationAsync(STREAK_PROTECT_ID).catch(() => {});
  }, []);

  // ── Quiet hours ────────────────────────────────────────────────────────────
  const updateQuietHours = useCallback(
    async (partial: Partial<QuietHours>) => {
      const next = { ...quietHoursRef.current, ...partial };
      setQuietHours(next);
      quietHoursRef.current = next;
      await AsyncStorage.setItem(QUIET_HOURS_KEY, JSON.stringify(next)).catch(() => {});
    },
    []
  );

  // ── Reminder tone + template apply ────────────────────────────────────────
  const setReminderTone = useCallback(async (tone: ReminderTone) => {
    setReminderToneState(tone);
    await AsyncStorage.setItem(REMINDER_TONE_KEY, tone).catch(() => {});
  }, []);

  /** Fills the 3 reminder slots with the first 3 messages from the tone pool, in order. */
  const applyToneToReminders = useCallback(
    async (tone: ReminderTone) => {
      await AsyncStorage.setItem(REMINDER_TONE_KEY, tone).catch(() => {});
      setReminderToneState(tone);
      const pool = REMINDER_TEMPLATES[tone];
      const updated = smartRemindersRef.current.map((r, i) => ({
        ...r,
        message: pool[i] ?? pool[0],
      })) as ReminderTuple;
      const rescheduled = await Promise.all(
        updated.map(async (r, i) => ({
          ...r,
          notifId: await scheduleSmartReminder(r, i),
        }))
      ) as ReminderTuple;
      setSmartReminders(rescheduled);
      smartRemindersRef.current = rescheduled;
      await AsyncStorage.setItem(SMART_REMINDERS_KEY, JSON.stringify(rescheduled)).catch(() => {});
    },
    []
  );

  /** Fills the 3 reminder slots with 3 randomly chosen messages from the tone pool. */
  const shuffleToneToReminders = useCallback(
    async (tone: ReminderTone) => {
      await AsyncStorage.setItem(REMINDER_TONE_KEY, tone).catch(() => {});
      setReminderToneState(tone);
      const messages = pickRandom(REMINDER_TEMPLATES[tone], 3);
      const updated = smartRemindersRef.current.map((r, i) => ({
        ...r,
        message: messages[i] ?? messages[0],
      })) as ReminderTuple;
      const rescheduled = await Promise.all(
        updated.map(async (r, i) => ({
          ...r,
          notifId: await scheduleSmartReminder(r, i),
        }))
      ) as ReminderTuple;
      setSmartReminders(rescheduled);
      smartRemindersRef.current = rescheduled;
      await AsyncStorage.setItem(SMART_REMINDERS_KEY, JSON.stringify(rescheduled)).catch(() => {});
    },
    []
  );

  // ── Scan result notification ───────────────────────────────────────────────
  const sendScanResultNotification = useCallback(
    async (score: number, hr: number | null, label: string) => {
      if (!hasPermission || Platform.OS === "web") return;
      const hrPart = hr ? ` · HR ${hr} BPM` : "";
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

  // ── Follow-up nudge (post low-score scan) ────────────────────────────────
  // Fires 90 minutes after a score ≤ 2 scan. Skipped if the fire time falls
  // inside the user's quiet-hours window.
  const scheduleFollowUpNudge = useCallback(
    async (score: 1 | 2) => {
      if (!hasPermission || Platform.OS === "web") return;
      const fireAt = new Date(Date.now() + 90 * 60 * 1000);
      if (isInQuietHours(fireAt.getHours(), fireAt.getMinutes(), quietHoursRef.current)) return;
      await Notifications.cancelScheduledNotificationAsync(FOLLOW_UP_NUDGE_ID).catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier: FOLLOW_UP_NUDGE_ID,
        content: {
          title: "Hydration Check-in",
          body: FOLLOW_UP_MESSAGES[score],
          sound: "default",
          interruptionLevel: "timeSensitive",
          data: { type: "follow-up-nudge" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 90 * 60,
          repeats: false,
        },
      }).catch(() => {});
    },
    [hasPermission]
  );

  // ── Cancel all ────────────────────────────────────────────────────────────
  const cancelAll = useCallback(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  }, []);

  return {
    hasPermission,
    scanAlarms,
    smartReminders,
    streakProtection,
    quietHours,
    reminderTone,
    requestPermission,
    updateScanAlarm,
    updateSmartReminder,
    updateStreakProtection,
    cancelStreakProtection,
    updateQuietHours,
    setReminderTone,
    applyToneToReminders,
    shuffleToneToReminders,
    sendScanResultNotification,
    scheduleFollowUpNudge,
    cancelAll,
  };
}
