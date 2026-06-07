export { ErrorBoundary } from "@/components/ErrorBoundary";

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Updates from "expo-updates";
import Constants from "expo-constants";

const legalBase: string | null =
  (Constants.expoConfig?.extra as { legalBaseUrl?: string | null } | undefined)
    ?.legalBaseUrl ?? null;

function openLegal(path: "privacy" | "terms") {
  const url = legalBase ? `${legalBase}/${path}` : null;
  if (!url) {
    Alert.alert(
      "Not Available",
      "The privacy policy is not yet configured for this build.",
    );
    return;
  }
  Linking.openURL(url).catch(() =>
    Alert.alert("Error", "Could not open the page. Please try again later."),
  );
}

import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { TimePicker, TimeValue, formatTime } from "@/components/TimePicker";
import { useHealth } from "@/context/HealthContext";
import { useHydration } from "@/context/HydrationContext";
import { useWaterIntake } from "@/context/WaterIntakeContext";
import { useColors } from "@/hooks/useColors";
import { ScanAlarm, SmartReminder } from "@/hooks/useNotifications";
import { useTour } from "@/hooks/useTour";
import {
  ALERT_THRESHOLD_LABELS,
  ALERT_THRESHOLDS,
  AlertThreshold,
} from "@/hooks/useWatchMonitor";

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionHeader({ title, iosOnly }: { title: string; iosOnly?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{title}</Text>
      {iosOnly && Platform.OS !== "ios" && (
        <View style={[styles.iosBadge, { backgroundColor: colors.mutedForeground + "18", borderColor: colors.mutedForeground + "30" }]}>
          <Text style={[styles.iosBadgeText, { color: colors.mutedForeground }]}>iOS only</Text>
        </View>
      )}
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  right,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingsRow,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed && onPress ? 0.78 : 1,
          transform: [{ scale: pressed && onPress ? 0.985 : 1 }],
        },
      ]}
      onPress={onPress}
      disabled={!onPress && !right}
    >
      <View
        style={[styles.rowIcon, { backgroundColor: destructive ? colors.destructive + "20" : colors.primary + "20" }]}
      >
        <Ionicons name={icon} size={18} color={destructive ? colors.destructive : colors.primary} />
      </View>
      <Text style={[styles.rowLabel, { color: destructive ? colors.destructive : colors.foreground }]}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        {value ? <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text> : null}
        {right ?? null}
        {onPress && !right ? <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} /> : null}
      </View>
    </Pressable>
  );
}

// ─── TimePicker modal ─────────────────────────────────────────────────────────

function TimePickerModal({
  visible,
  title,
  value,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  value: TimeValue;
  onSave: (v: TimeValue) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<TimeValue>(value);

  useEffect(() => { if (visible) setDraft(value); }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.card, paddingBottom: insets.bottom + 20, borderTopColor: colors.border },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{title}</Text>
        <View style={[styles.pickerWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <TimePicker value={draft} onChange={setDraft} />
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.doneBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
          onPress={() => { onSave(draft); onClose(); }}
        >
          <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Alert Threshold picker ───────────────────────────────────────────────────

function AlertThresholdModal({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: AlertThreshold;
  onSelect: (v: AlertThreshold) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const descriptions: Record<AlertThreshold, string> = {
    0: "Never send hydration alerts.",
    1: "Alert when auto-scan detects hydration at level 1 (Critical).",
    2: "Alert when auto-scan detects hydration at level 2 (Low) or below.",
    3: "Alert when auto-scan detects hydration at level 3 (Good) or below.",
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.card, paddingBottom: insets.bottom + 20, borderTopColor: colors.border },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Hydration Alert Level</Text>
        <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
          Choose the score level at which you want an alert. When an auto-scan detects your hydration has dropped to that level or below, you'll receive a notification on your phone and Watch.
        </Text>
        {ALERT_THRESHOLDS.map((v) => (
          <TouchableOpacity
            key={v}
            style={[
              styles.option,
              { backgroundColor: current === v ? colors.primary + "15" : colors.background, borderColor: current === v ? colors.primary + "60" : colors.border },
            ]}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onSelect(v); onClose(); }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionText, { color: current === v ? colors.primary : colors.foreground }]}>
                {ALERT_THRESHOLD_LABELS[v]}
              </Text>
              <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>{descriptions[v]}</Text>
            </View>
            {current === v && <Ionicons name="checkmark" size={18} color={colors.primary} />}
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

// ─── Scan Alarm slot card ─────────────────────────────────────────────────────

function AlarmSlotCard({
  index,
  alarm,
  onUpdate,
  onRequestPermission,
}: {
  index: number;
  alarm: ScanAlarm;
  onUpdate: (partial: Partial<ScanAlarm>) => Promise<void>;
  onRequestPermission: () => Promise<boolean>;
}) {
  const colors = useColors();
  const [showPicker, setShowPicker] = useState(false);
  const timeVal: TimeValue = { hour: alarm.hour, minute: alarm.minute, ampm: alarm.ampm };

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      const granted = await onRequestPermission();
      if (!granted) {
        Alert.alert("Notifications Required", "Enable notifications in iPhone Settings to use Scan Alarms.", [{ text: "OK" }]);
        return;
      }
    }
    Haptics.selectionAsync().catch(() => {});
    await onUpdate({ enabled });
  };

  const handleTimeSave = async (v: TimeValue) => {
    await onUpdate({ hour: v.hour, minute: v.minute, ampm: v.ampm });
  };

  return (
    <>
      <View style={[styles.alarmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.alarmIconWrap, { backgroundColor: colors.primary + "20" }]}>
          <Ionicons name="watch-outline" size={16} color={colors.primary} />
        </View>
        <View style={styles.alarmMiddle}>
          <Text style={[styles.alarmLabel, { color: colors.foreground }]}>Alarm {index + 1}</Text>
          <Pressable onPress={() => setShowPicker(true)} hitSlop={8}>
            <Text style={[styles.alarmTime, { color: alarm.enabled ? colors.primary : colors.mutedForeground }]}>
              {formatTime(timeVal)}
            </Text>
          </Pressable>
        </View>
        <Switch
          value={alarm.enabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.border, true: colors.primary + "80" }}
          thumbColor={alarm.enabled ? colors.primary : colors.mutedForeground}
        />
      </View>
      <TimePickerModal
        visible={showPicker}
        title={`Alarm ${index + 1} — Set Time`}
        value={timeVal}
        onSave={handleTimeSave}
        onClose={() => setShowPicker(false)}
      />
    </>
  );
}

// ─── Smart Reminder slot card ─────────────────────────────────────────────────

function ReminderSlotCard({
  index,
  reminder,
  onUpdate,
  onRequestPermission,
}: {
  index: number;
  reminder: SmartReminder;
  onUpdate: (partial: Partial<SmartReminder>) => Promise<void>;
  onRequestPermission: () => Promise<boolean>;
}) {
  const colors = useColors();
  const [showPicker, setShowPicker] = useState(false);
  const [msgDraft, setMsgDraft] = useState(reminder.message);
  const timeVal: TimeValue = { hour: reminder.hour, minute: reminder.minute, ampm: reminder.ampm };

  // Keep local draft in sync if reminder changes externally
  useEffect(() => { setMsgDraft(reminder.message); }, [reminder.message]);

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      const granted = await onRequestPermission();
      if (!granted) {
        Alert.alert("Notifications Required", "Enable notifications in iPhone Settings to use Smart Reminders.", [{ text: "OK" }]);
        return;
      }
    }
    Haptics.selectionAsync().catch(() => {});
    await onUpdate({ enabled });
  };

  const handleTimeSave = async (v: TimeValue) => {
    await onUpdate({ hour: v.hour, minute: v.minute, ampm: v.ampm });
  };

  const handleMessageCommit = async () => {
    if (msgDraft !== reminder.message) {
      await onUpdate({ message: msgDraft });
    }
  };

  return (
    <>
      <View style={[styles.reminderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.reminderCardTop}>
          <View style={[styles.alarmIconWrap, { backgroundColor: colors.accent + "20" }]}>
            <Ionicons name="alarm-outline" size={16} color={colors.accent} />
          </View>
          <View style={styles.alarmMiddle}>
            <Text style={[styles.alarmLabel, { color: colors.foreground }]}>Reminder {index + 1}</Text>
            <Pressable onPress={() => setShowPicker(true)} hitSlop={8}>
              <Text style={[styles.alarmTime, { color: reminder.enabled ? colors.accent : colors.mutedForeground }]}>
                {formatTime(timeVal)}
              </Text>
            </Pressable>
          </View>
          <Switch
            value={reminder.enabled}
            onValueChange={handleToggle}
            trackColor={{ false: colors.border, true: colors.accent + "80" }}
            thumbColor={reminder.enabled ? colors.accent : colors.mutedForeground}
          />
        </View>
        <TextInput
          style={[
            styles.msgInput,
            { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
          ]}
          placeholder="Message (e.g. Drink 8 oz of water)"
          placeholderTextColor={colors.mutedForeground}
          value={msgDraft}
          onChangeText={setMsgDraft}
          onEndEditing={handleMessageCommit}
          onBlur={handleMessageCommit}
          returnKeyType="done"
          maxLength={80}
        />
      </View>
      <TimePickerModal
        visible={showPicker}
        title={`Reminder ${index + 1} — Set Time`}
        value={timeVal}
        onSave={handleTimeSave}
        onClose={() => setShowPicker(false)}
      />
    </>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scansThisWeek, history } = useHydration();
  const { dailyGoalOz, setDailyGoalOz } = useWaterIntake();
  const {
    healthKitAvailable,
    healthKitEnabled,
    scanAlarms,
    smartReminders,
    alertThreshold,
    nudgeEnabled,
    nudgeWindowStart,
    nudgeWindowEnd,
    setNudgeEnabled,
    setNudgeWindow,
    smartScheduleEnabled,
    smartScheduledTimes,
    lastScheduledDate,
    isScheduling,
    enableSmartSchedule,
    disableSmartSchedule,
    refreshSmartSchedule,
    hasEnoughData,
    pendingSuggestions,
    suggestionDismissed,
    dismissSuggestion,
    connectHealthKit,
    refreshHealthData,
    requestNotificationPermission,
    updateScanAlarm,
    updateSmartReminder,
    setAlertThreshold,
  } = useHealth();

  const { resetTour } = useTour();

  const [showThreshold, setShowThreshold] = useState(false);
  const [showNudgeStart, setShowNudgeStart] = useState(false);
  const [showNudgeEnd, setShowNudgeEnd]     = useState(false);

  // Convert a 24-hour integer (0–23) to the TimeValue the TimePicker expects
  function hour24ToTimeValue(h24: number): TimeValue {
    const ampm: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
    let hour = h24 % 12;
    if (hour === 0) hour = 12;
    return { hour, minute: 0, ampm };
  }
  function timeValueToHour24(v: TimeValue): number {
    if (v.ampm === "AM" && v.hour === 12) return 0;
    if (v.ampm === "PM" && v.hour !== 12) return v.hour + 12;
    return v.hour;
  }
  function formatHour24(h24: number): string {
    const ampm = h24 >= 12 ? "PM" : "AM";
    let h = h24 % 12;
    if (h === 0) h = 12;
    return `${h}:00 ${ampm}`;
  }

  const handleConnectHealth = async () => {
    if (Platform.OS !== "ios") {
      Alert.alert("iOS Only", "Apple Health integration is only available on iPhone.");
      return;
    }
    if (healthKitEnabled) {
      refreshHealthData();
      Alert.alert("Apple Health", "Health data refreshed.");
      return;
    }
    const result = await connectHealthKit();
    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("Connected", "HydraPulse can now read your heart rate and HRV from Apple Health.");
    } else {
      const detail = result.error ? `\n\nDiagnostic: ${result.error}` : "";
      Alert.alert(
        "Health Access Unavailable",
        "HydraPulse could not connect to Apple Health.\n\n" +
        "Go to Settings → Privacy & Security → Health → HydraPulse and enable read access." +
        detail,
        [{ text: "Cancel", style: "cancel" }, { text: "Open Settings", onPress: () => Linking.openSettings() }]
      );
    }
  };

  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "downloading" | "up-to-date" | "error">("idle");

  const handleCheckUpdate = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Not available", "Updates are only available on device builds.");
      return;
    }
    setUpdateStatus("checking");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) {
        setUpdateStatus("downloading");
        await Updates.fetchUpdateAsync();
        Alert.alert(
          "Update ready",
          "A new version has been downloaded. The app will now restart to apply it.",
          [{ text: "Restart now", onPress: () => Updates.reloadAsync() }]
        );
      } else {
        setUpdateStatus("up-to-date");
        Alert.alert("Up to date", "You're already running the latest version.");
        setTimeout(() => setUpdateStatus("idle"), 3000);
      }
    } catch {
      setUpdateStatus("error");
      Alert.alert("Update check failed", "Could not check for updates. Make sure you're connected to the internet.");
      setTimeout(() => setUpdateStatus("idle"), 3000);
    }
  };

  const handleSetGoal = () => {
    const opts = [48, 64, 80, 96, 128];
    Alert.alert(
      "Daily Water Goal",
      "How many ounces do you aim to drink each day?",
      [
        ...opts.map((oz) => ({
          text: `${oz} oz${oz === dailyGoalOz ? " (current)" : ""}`,
          onPress: () => {
            Haptics.selectionAsync().catch(() => {});
            setDailyGoalOz(oz).catch(() => {});
          },
        })),
        { text: "Cancel", style: "cancel" as const },
      ]
    );
  };

  const handleAlertThreshold = async (v: AlertThreshold) => {
    if (v > 0) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert("Notifications Required", "Enable notifications in iPhone Settings to receive low-hydration alerts.", [{ text: "OK" }]);
        return;
      }
    }
    await setAlertThreshold(v);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? insets.top + 67 : 0 },
      ]}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Testing Mode Banner */}
        <View style={[styles.testingBanner, { backgroundColor: colors.accent + "15", borderColor: colors.accent + "40" }]}>
          <Ionicons name="flask-outline" size={20} color={colors.accent} />
          <Text style={[styles.testingText, { color: colors.accent }]}>
            Testing Mode — All Features Unlocked
          </Text>
        </View>

        {/* Workout */}
        <SectionHeader title="Workout" />
        <View style={styles.group}>
          <SettingsRow
            icon="barbell-outline"
            label="Sweat Loss Tracker"
            value="Start / End Workout"
            onPress={() => router.push("/workout")}
          />
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View style={styles.group}>
          <SettingsRow icon="diamond" label="Premium Plan" value="Unlocked" />
          <SettingsRow icon="bar-chart-outline" label="Total Scans" value={String(history.length)} />
          <SettingsRow icon="scan-outline" label="Scans This Week" value={`${scansThisWeek} / ∞`} />
        </View>

        {/* Hydration */}
        <SectionHeader title="Hydration" />
        <View style={styles.group}>
          <SettingsRow
            icon="water-outline"
            label="Daily Water Goal"
            value={`${dailyGoalOz} oz`}
            onPress={handleSetGoal}
          />
        </View>

        {/* Integrations */}
        <SectionHeader title="Integrations" />
        <View style={styles.group}>
          <SettingsRow
            icon="heart-outline"
            label="Apple Health"
            value={
              Platform.OS !== "ios" ? "iOS only"
              : !healthKitAvailable ? "Unavailable"
              : healthKitEnabled ? "Connected"
              : "Connect"
            }
            onPress={Platform.OS === "ios" ? handleConnectHealth : undefined}
          />
          <SettingsRow
            icon="notifications-outline"
            label="Hydration Alert Level"
            value={Platform.OS !== "ios" ? "iOS only" : ALERT_THRESHOLD_LABELS[alertThreshold]}
            onPress={Platform.OS === "ios" ? () => setShowThreshold(true) : undefined}
          />
        </View>

        {/* Watch Scan Alarms */}
        <SectionHeader title="Watch Scan Alarms" iosOnly />
        <View style={[styles.sectionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.boxTitle, { color: colors.foreground }]}>Scheduled Scans</Text>
          <Text style={[styles.boxSub, { color: colors.mutedForeground }]}>
            At the set time a notification will remind you to open HydraPulse, which
            then automatically reads your Apple Watch data and saves a hydration scan.
            Requires Apple Health to be connected.
          </Text>

          {/* Android notice */}
          {Platform.OS !== "ios" && (
            <View style={[styles.infoRow, { backgroundColor: colors.mutedForeground + "10", borderColor: colors.mutedForeground + "25" }]}>
              <Ionicons name="logo-apple" size={16} color={colors.mutedForeground} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                Watch Scan Alarms require an Apple Watch and iOS. These settings have no effect on Android.
              </Text>
            </View>
          )}

          {/* Exercise HR note */}
          <View style={[styles.infoRow, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Watch scans read stored HealthKit data (averaged HR and HRV). Immediately after
              exercise your Watch HR may not yet be written to HealthKit, so torch and Watch
              scores can differ. For the most accurate Watch result, wait 5–10 minutes post-exercise.
            </Text>
          </View>

          <View style={styles.slotGroup}>
            {scanAlarms.map((alarm, i) => (
              <AlarmSlotCard
                key={i}
                index={i}
                alarm={alarm}
                onUpdate={(p) => updateScanAlarm(i as 0 | 1 | 2, p)}
                onRequestPermission={requestNotificationPermission}
              />
            ))}
          </View>
        </View>

        {/* Smart Reminders */}
        <SectionHeader title="Smart Reminders" />
        <View style={[styles.sectionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.boxTitle, { color: colors.foreground }]}>Daily Reminders</Text>
          <Text style={[styles.boxSub, { color: colors.mutedForeground }]}>
            Two layers of reminders work together: Gap & Goal Nudges fire the moment you return to the app after a long gap or fall behind on your daily goal. Auto-Schedule learns your patterns and sets fixed-time reminders in your natural hydration windows.
          </Text>

          {/* Gap & Goal Nudges toggle */}
          <View style={[styles.autoScheduleRow, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
            <View style={[styles.alarmIconWrap, { backgroundColor: colors.primary + "20" }]}>
              <Ionicons name="pulse-outline" size={16} color={colors.primary} />
            </View>
            <View style={styles.alarmMiddle}>
              <Text style={[styles.alarmLabel, { color: colors.foreground }]}>Gap & Goal Nudges</Text>
              <Text style={[styles.autoScheduleSub, { color: colors.mutedForeground }]}>
                Fires when 3h gap detected or goal is behind
              </Text>
            </View>
            <Switch
              value={nudgeEnabled}
              onValueChange={async (on) => {
                Haptics.selectionAsync().catch(() => {});
                if (on) {
                  const granted = await requestNotificationPermission();
                  if (!granted) {
                    Alert.alert(
                      "Notifications Required",
                      "Enable notifications in iPhone Settings to use Gap & Goal Nudges.",
                      [{ text: "OK" }],
                    );
                    return;
                  }
                }
                await setNudgeEnabled(on);
              }}
              trackColor={{ false: colors.border, true: colors.primary + "80" }}
              thumbColor={nudgeEnabled ? colors.primary : colors.mutedForeground}
            />
          </View>

          {nudgeEnabled && (
            <View style={styles.slotGroup}>
              {/* Active from */}
              <View style={[styles.alarmCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[styles.alarmIconWrap, { backgroundColor: colors.primary + "15" }]}>
                  <Ionicons name="play-outline" size={15} color={colors.primary} />
                </View>
                <View style={styles.alarmMiddle}>
                  <Text style={[styles.alarmLabel, { color: colors.mutedForeground }]}>Active from</Text>
                  <Pressable onPress={() => setShowNudgeStart(true)} hitSlop={8}>
                    <Text style={[styles.alarmTime, { color: colors.primary }]}>
                      {formatHour24(nudgeWindowStart)}
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => setShowNudgeStart(true)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  hitSlop={12}
                >
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {/* Active until */}
              <View style={[styles.alarmCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[styles.alarmIconWrap, { backgroundColor: colors.primary + "15" }]}>
                  <Ionicons name="stop-outline" size={15} color={colors.primary} />
                </View>
                <View style={styles.alarmMiddle}>
                  <Text style={[styles.alarmLabel, { color: colors.mutedForeground }]}>Active until</Text>
                  <Pressable onPress={() => setShowNudgeEnd(true)} hitSlop={8}>
                    <Text style={[styles.alarmTime, { color: colors.primary }]}>
                      {formatHour24(nudgeWindowEnd)}
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => setShowNudgeEnd(true)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  hitSlop={12}
                >
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>

              <View style={[styles.infoRow, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}>
                <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                  Nudges only fire between {formatHour24(nudgeWindowStart)} and {formatHour24(nudgeWindowEnd)}. Gap check: 3 h on weekdays, 3.5 h on weekends. Goal check fires in the last part of the window if you're below 50% of your daily goal. At most once per hour.
                </Text>
              </View>
            </View>
          )}

          {/* Pattern suggestion card — shown when enough data exists and user hasn't enabled Auto-Schedule or dismissed */}
          {!smartScheduleEnabled && hasEnoughData && !suggestionDismissed && (
            <View style={[styles.suggestionCard, { backgroundColor: colors.accent + "08", borderColor: colors.accent + "30" }]}>
              <View style={styles.suggestionHeader}>
                <View style={[styles.suggestionIconWrap, { backgroundColor: colors.accent + "20" }]}>
                  <Ionicons name="sparkles" size={14} color={colors.accent} />
                </View>
                <Text style={[styles.suggestionTitle, { color: colors.foreground }]}>Pattern Detected</Text>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    dismissSuggestion();
                  }}
                  hitSlop={12}
                >
                  <Ionicons name="close" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <Text style={[styles.suggestionBody, { color: colors.mutedForeground }]}>
                Based on your last 14 days, these times fall in your natural hydration gaps:
              </Text>
              <View style={styles.suggestionTimes}>
                {pendingSuggestions.map((s, i) => (
                  <View key={i} style={[styles.suggestionTime, { backgroundColor: colors.accent + "12", borderColor: colors.accent + "25" }]}>
                    <Ionicons name="alarm-outline" size={13} color={colors.accent} />
                    <Text style={[styles.suggestionTimeText, { color: colors.accent }]}>{s.displayTime}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.suggestionApplyBtn,
                  { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  const granted = await requestNotificationPermission();
                  if (!granted) {
                    Alert.alert(
                      "Notifications Required",
                      "Enable notifications in iPhone Settings to use Smart Reminders.",
                      [{ text: "OK" }]
                    );
                    return;
                  }
                  await enableSmartSchedule();
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                <Text style={styles.suggestionApplyText}>Use These Times</Text>
              </Pressable>
            </View>
          )}

          {/* Auto-Schedule toggle */}
          <View style={[styles.autoScheduleRow, { backgroundColor: colors.accent + "10", borderColor: colors.accent + "30" }]}>
            <View style={[styles.alarmIconWrap, { backgroundColor: colors.accent + "20" }]}>
              <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
            </View>
            <View style={styles.alarmMiddle}>
              <Text style={[styles.alarmLabel, { color: colors.foreground }]}>Auto-Schedule</Text>
              <Text style={[styles.autoScheduleSub, { color: colors.mutedForeground }]}>
                Learns your patterns, picks the best times
              </Text>
            </View>
            <Switch
              value={smartScheduleEnabled}
              onValueChange={async (on) => {
                Haptics.selectionAsync().catch(() => {});
                if (on) {
                  const granted = await requestNotificationPermission();
                  if (!granted) {
                    Alert.alert(
                      "Notifications Required",
                      "Enable notifications in iPhone Settings to use Smart Reminders.",
                      [{ text: "OK" }]
                    );
                    return;
                  }
                  await enableSmartSchedule();
                } else {
                  await disableSmartSchedule();
                }
              }}
              trackColor={{ false: colors.border, true: colors.accent + "80" }}
              thumbColor={smartScheduleEnabled ? colors.accent : colors.mutedForeground}
            />
          </View>

          {smartScheduleEnabled ? (
            /* ── Auto-schedule view ── */
            <View style={styles.slotGroup}>
              {isScheduling ? (
                <View style={[styles.schedulingRow, { borderColor: colors.border }]}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={[styles.schedulingText, { color: colors.mutedForeground }]}>
                    Analyzing your patterns...
                  </Text>
                </View>
              ) : (
                <>
                  {(smartScheduledTimes.length > 0
                    ? smartScheduledTimes
                    : [
                        { displayTime: "9:00 AM", message: "" },
                        { displayTime: "1:00 PM", message: "" },
                        { displayTime: "6:00 PM", message: "" },
                      ]
                  ).map((slot, i) => (
                    <View
                      key={i}
                      style={[styles.scheduledSlot, { backgroundColor: colors.background, borderColor: colors.border }]}
                    >
                      <View style={[styles.alarmIconWrap, { backgroundColor: colors.accent + "15" }]}>
                        <Ionicons name="alarm-outline" size={15} color={colors.accent} />
                      </View>
                      <View style={styles.alarmMiddle}>
                        <Text style={[styles.alarmLabel, { color: colors.mutedForeground }]}>
                          Reminder {i + 1}
                        </Text>
                        <Text style={[styles.alarmTime, { color: colors.accent }]}>
                          {slot.displayTime}
                        </Text>
                      </View>
                      <Ionicons name="checkmark-circle" size={18} color={colors.accent + "80"} />
                    </View>
                  ))}

                  {/* Last updated + refresh */}
                  <View style={styles.scheduleFooter}>
                    <Text style={[styles.scheduleLastRun, { color: colors.mutedForeground }]}>
                      {lastScheduledDate
                        ? `Updated ${new Date(lastScheduledDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${new Date(lastScheduledDate).toLocaleDateString([], { month: "short", day: "numeric" })}`
                        : "Not yet scheduled"}
                    </Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.refreshBtn,
                        { backgroundColor: colors.accent + "15", borderColor: colors.accent + "30", opacity: pressed ? 0.7 : 1 },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        refreshSmartSchedule();
                      }}
                    >
                      <Ionicons name="refresh-outline" size={14} color={colors.accent} />
                      <Text style={[styles.refreshBtnText, { color: colors.accent }]}>Refresh Now</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          ) : (
            /* ── Manual slot cards ── */
            <View style={styles.slotGroup}>
              {smartReminders.map((reminder, i) => (
                <ReminderSlotCard
                  key={i}
                  index={i}
                  reminder={reminder}
                  onUpdate={(p) => updateSmartReminder(i as 0 | 1 | 2, p)}
                  onRequestPermission={requestNotificationPermission}
                />
              ))}
            </View>
          )}
        </View>

        {/* Privacy & Data */}
        <SectionHeader title="Privacy & Data" />
        <View style={styles.group}>
          <SettingsRow icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => openLegal("privacy")} />
          <SettingsRow icon="document-text-outline" label="Terms of Service" onPress={() => openLegal("terms")} />
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View style={styles.group}>
          <SettingsRow icon="information-circle-outline" label="Version" value="1.0.0" />
          <SettingsRow icon="code-slash-outline" label="Mode" value="Camera + Watch PPG" />
          <SettingsRow
            icon="map-outline"
            label="Feature Tour"
            value="Replay"
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              resetTour();
            }}
          />
          <SettingsRow
            icon="cloud-download-outline"
            label="Check for Updates"
            value={
              updateStatus === "checking" ? "Checking..." :
              updateStatus === "downloading" ? "Downloading..." :
              updateStatus === "up-to-date" ? "Up to date" :
              updateStatus === "error" ? "Failed" :
              ""
            }
            onPress={updateStatus === "idle" || updateStatus === "up-to-date" || updateStatus === "error" ? handleCheckUpdate : undefined}
          />
        </View>

        <View style={{ marginTop: 8 }}>
          <DisclaimerBanner />
        </View>
      </ScrollView>

      <AlertThresholdModal
        visible={showThreshold}
        current={alertThreshold}
        onSelect={handleAlertThreshold}
        onClose={() => setShowThreshold(false)}
      />

      <TimePickerModal
        visible={showNudgeStart}
        title="Nudges active from"
        value={hour24ToTimeValue(nudgeWindowStart)}
        onSave={(v) => setNudgeWindow(timeValueToHour24(v), nudgeWindowEnd)}
        onClose={() => setShowNudgeStart(false)}
      />
      <TimePickerModal
        visible={showNudgeEnd}
        title="Nudges active until"
        value={hour24ToTimeValue(nudgeWindowEnd)}
        onSave={(v) => setNudgeWindow(nudgeWindowStart, timeValueToHour24(v))}
        onClose={() => setShowNudgeEnd(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  testingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 4,
  },
  testingText: { fontSize: 15, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  iosBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  iosBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  group: { gap: 2 },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 2,
  },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowValue: { fontSize: 14, fontFamily: "Inter_400Regular" },
  sectionBox: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  boxTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  boxSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  slotGroup: { gap: 10 },
  alarmCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reminderCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 10,
  },
  reminderCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  alarmIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  alarmMiddle: { flex: 1, gap: 2 },
  alarmLabel: { fontSize: 14, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  alarmTime: { fontSize: 18, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  msgInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  // Modal styles
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 24,
    gap: 16,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  sheetSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: -8 },
  pickerWrap: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  doneBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  doneBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  optionText: { fontSize: 16, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  optionDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
  // Smart schedule — suggestion card
  suggestionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  suggestionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  suggestionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  suggestionTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  suggestionBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  suggestionTimes: {
    flexDirection: "row" as const,
    gap: 8,
    flexWrap: "wrap" as const,
  },
  suggestionTime: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  suggestionTimeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  suggestionApplyBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  suggestionApplyText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    color: "#fff",
  },
  autoScheduleRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  autoScheduleSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  schedulingRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  schedulingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  scheduledSlot: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  scheduleFooter: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 8,
    paddingTop: 2,
  },
  scheduleLastRun: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  refreshBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  refreshBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
});
