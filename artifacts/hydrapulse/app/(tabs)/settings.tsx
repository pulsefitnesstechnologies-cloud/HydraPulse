import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
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

import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { TimePicker, TimeValue, formatTime } from "@/components/TimePicker";
import { useHealth } from "@/context/HealthContext";
import { useHydration } from "@/context/HydrationContext";
import { useWaterIntake } from "@/context/WaterIntakeContext";
import { useColors } from "@/hooks/useColors";
import { ScanAlarm, SmartReminder } from "@/hooks/useNotifications";
import {
  ALERT_THRESHOLD_LABELS,
  ALERT_THRESHOLDS,
  AlertThreshold,
} from "@/hooks/useWatchMonitor";

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{title}</Text>
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
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed && onPress ? 0.75 : 1 },
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
          style={[styles.doneBtn, { backgroundColor: colors.primary }]}
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
    1: "Alert when hydration is Critical (score 1).",
    2: "Alert when hydration is Low or Critical (score 1–2).",
    3: "Alert when hydration is Good, Low, or Critical (score 1–3).",
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
        <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Hydration Alert Threshold</Text>
        <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
          Sends a banner notification when your hydration score drops to or below this level.
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
  const { scansThisWeek, history, clearHistory } = useHydration();
  const { clearWaterLog } = useWaterIntake();
  const {
    healthKitAvailable,
    healthKitEnabled,
    scanAlarms,
    smartReminders,
    alertThreshold,
    connectHealthKit,
    refreshHealthData,
    requestNotificationPermission,
    updateScanAlarm,
    updateSmartReminder,
    setAlertThreshold,
  } = useHealth();

  const [showThreshold, setShowThreshold] = useState(false);

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

  const handleClearHistory = () => {
    Alert.alert(
      "Clear All Data",
      "This will permanently delete all scan history and water intake logs. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await Promise.all([clearHistory(), clearWaterLog()]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          },
        },
      ]
    );
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
            label="Hydration Alert Threshold"
            value={Platform.OS !== "ios" ? "iOS only" : ALERT_THRESHOLD_LABELS[alertThreshold]}
            onPress={Platform.OS === "ios" ? () => setShowThreshold(true) : undefined}
          />
        </View>

        {/* Watch Scan Alarms */}
        <SectionHeader title="Watch Scan Alarms" />
        <View style={[styles.sectionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.boxTitle, { color: colors.foreground }]}>Scheduled Scans</Text>
          <Text style={[styles.boxSub, { color: colors.mutedForeground }]}>
            At the set time a notification will remind you to open HydraPulse, which
            then automatically reads your Apple Watch data and saves a hydration scan.
            Requires Apple Health to be connected.
          </Text>

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
            Each reminder fires a banner notification at the set time with your custom
            message. Use it to prompt yourself to drink water or check your hydration.
          </Text>
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
        </View>

        {/* Privacy & Data */}
        <SectionHeader title="Privacy & Data" />
        <View style={styles.group}>
          <SettingsRow icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => {}} />
          <SettingsRow icon="document-text-outline" label="Terms of Service" onPress={() => {}} />
          <SettingsRow icon="trash-outline" label="Clear All History" onPress={handleClearHistory} destructive />
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View style={styles.group}>
          <SettingsRow icon="information-circle-outline" label="Version" value="1.0.0" />
          <SettingsRow icon="code-slash-outline" label="Mode" value="Camera + Watch PPG" />
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
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 4,
    paddingHorizontal: 4,
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
  sectionBox: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 14 },
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
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reminderCard: {
    borderRadius: 14,
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
});
