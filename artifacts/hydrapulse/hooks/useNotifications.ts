import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

export interface ReminderSchedule {
  morningEnabled: boolean;
  afternoonEnabled: boolean;
  eveningEnabled: boolean;
}

export const DEFAULT_SCHEDULE: ReminderSchedule = {
  morningEnabled: false,
  afternoonEnabled: false,
  eveningEnabled: false,
};

const MESSAGES = [
  "How hydrated are you? Run a quick scan to find out.",
  "Time to check in — hydration affects your energy and focus.",
  "A quick HydraPulse scan takes only 12 seconds.",
  "Stay sharp. Check your hydration levels now.",
];

function randomMessage() {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function useNotifications() {
  const [hasPermission, setHasPermission] = useState(false);
  const [schedule, setSchedule] = useState<ReminderSchedule>(DEFAULT_SCHEDULE);

  useEffect(() => {
    if (Platform.OS === "web") return;
    Notifications.getPermissionsAsync().then(({ status }) => {
      setHasPermission(status === "granted");
    });
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") return false;
    const { status } = await Notifications.requestPermissionsAsync();
    const granted = status === "granted";
    setHasPermission(granted);
    return granted;
  }, []);

  const scheduleReminders = useCallback(
    async (newSchedule: ReminderSchedule) => {
      setSchedule(newSchedule);
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!hasPermission || Platform.OS === "web") return;

      const slots: Array<{ hour: number; label: string; enabled: boolean }> = [
        { hour: 8, label: "Morning", enabled: newSchedule.morningEnabled },
        { hour: 13, label: "Afternoon", enabled: newSchedule.afternoonEnabled },
        { hour: 19, label: "Evening", enabled: newSchedule.eveningEnabled },
      ];

      for (const slot of slots) {
        if (!slot.enabled) continue;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${slot.label} Hydration Check`,
            body: randomMessage(),
            sound: false,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: slot.hour,
            minute: 0,
          },
        });
      }
    },
    [hasPermission]
  );

  const cancelAll = useCallback(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    setSchedule(DEFAULT_SCHEDULE);
  }, []);

  return { hasPermission, schedule, requestPermission, scheduleReminders, cancelAll };
}
