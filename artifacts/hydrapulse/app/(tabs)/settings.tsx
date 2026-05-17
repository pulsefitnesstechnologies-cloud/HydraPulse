import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { useHealth } from "@/context/HealthContext";
import { useHydration } from "@/context/HydrationContext";
import { useColors } from "@/hooks/useColors";
import { WATCH_INTERVALS, WatchInterval } from "@/hooks/useWatchMonitor";

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
          opacity: pressed && onPress ? 0.75 : 1,
        },
      ]}
      onPress={onPress}
      disabled={!onPress && !right}
    >
      <View
        style={[
          styles.rowIcon,
          {
            backgroundColor: destructive
              ? colors.destructive + "20"
              : colors.primary + "20",
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={destructive ? colors.destructive : colors.primary}
        />
      </View>
      <Text
        style={[
          styles.rowLabel,
          { color: destructive ? colors.destructive : colors.foreground },
        ]}
      >
        {label}
      </Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>
        ) : null}
        {right ?? null}
        {onPress && !right ? (
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        ) : null}
      </View>
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>
      {title}
    </Text>
  );
}

function ReminderToggles() {
  const colors = useColors();
  const {
    reminderSchedule,
    notificationPermission,
    requestNotificationPermission,
    updateReminderSchedule,
  } = useHealth();

  const toggle = async (key: "morningEnabled" | "afternoonEnabled" | "eveningEnabled") => {
    let permission = notificationPermission;
    if (!permission) {
      permission = await requestNotificationPermission();
      if (!permission) {
        Alert.alert(
          "Notifications Disabled",
          "Enable notifications in your iPhone Settings to receive hydration reminders.",
          [{ text: "OK" }]
        );
        return;
      }
    }
    Haptics.selectionAsync().catch(() => {});
    await updateReminderSchedule({
      ...reminderSchedule,
      [key]: !reminderSchedule[key],
    });
  };

  const slots: Array<{
    key: "morningEnabled" | "afternoonEnabled" | "eveningEnabled";
    label: string;
    time: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    { key: "morningEnabled", label: "Morning", time: "8:00 AM", icon: "sunny-outline" },
    { key: "afternoonEnabled", label: "Afternoon", time: "1:00 PM", icon: "partly-sunny-outline" },
    { key: "eveningEnabled", label: "Evening", time: "7:00 PM", icon: "moon-outline" },
  ];

  return (
    <View style={[styles.reminderBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.reminderTitle, { color: colors.foreground }]}>
        Daily Reminders
      </Text>
      <Text style={[styles.reminderSub, { color: colors.mutedForeground }]}>
        Receive a notification to run a hydration scan at these times.
      </Text>
      {slots.map((slot, i) => (
        <View
          key={slot.key}
          style={[
            styles.reminderSlot,
            { borderTopColor: colors.border, borderTopWidth: i === 0 ? 0 : 1 },
          ]}
        >
          <Ionicons name={slot.icon} size={16} color={colors.mutedForeground} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.slotLabel, { color: colors.foreground }]}>{slot.label}</Text>
            <Text style={[styles.slotTime, { color: colors.mutedForeground }]}>{slot.time}</Text>
          </View>
          <Switch
            value={reminderSchedule[slot.key]}
            onValueChange={() => toggle(slot.key)}
            trackColor={{ false: colors.border, true: colors.primary + "80" }}
            thumbColor={reminderSchedule[slot.key] ? colors.primary : colors.mutedForeground}
          />
        </View>
      ))}
    </View>
  );
}

function WatchIntervalPicker({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: WatchInterval;
  onSelect: (v: WatchInterval) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const label = (h: WatchInterval) => (h === 0 ? "Off" : `Every ${h}h`);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <View
        style={[
          styles.modalSheet,
          {
            backgroundColor: colors.card,
            paddingBottom: insets.bottom + 20,
            borderTopColor: colors.border,
          },
        ]}
      >
        <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
        <Text style={[styles.modalTitle, { color: colors.foreground }]}>
          Watch Monitoring Interval
        </Text>
        <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
          HydraPulse will read Apple Watch heart rate and HRV at this interval
          and alert you if hydration appears low.
        </Text>
        {WATCH_INTERVALS.map((h) => (
          <TouchableOpacity
            key={h}
            style={[
              styles.intervalOption,
              {
                backgroundColor:
                  current === h ? colors.primary + "15" : colors.background,
                borderColor: current === h ? colors.primary + "60" : colors.border,
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onSelect(h);
              onClose();
            }}
          >
            <Text
              style={[
                styles.intervalOptionText,
                { color: current === h ? colors.primary : colors.foreground },
              ]}
            >
              {label(h)}
            </Text>
            {current === h && (
              <Ionicons name="checkmark" size={18} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scansThisWeek, history, clearHistory } = useHydration();
  const {
    healthKitAvailable,
    healthKitEnabled,
    notificationsEnabled,
    watchInterval,
    connectHealthKit,
    refreshHealthData,
    setWatchInterval,
    requestNotificationPermission,
  } = useHealth();

  const [showReminders, setShowReminders] = useState(false);
  const [showIntervalPicker, setShowIntervalPicker] = useState(false);

  const handleClearHistory = () => {
    if (Platform.OS === "web") {
      clearHistory();
      return;
    }
    Alert.alert(
      "Clear History",
      "This will permanently delete all your scan history. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            clearHistory();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          },
        },
      ]
    );
  };

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
    const ok = await connectHealthKit();
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        "Connected",
        "HydraPulse can now read your heart rate and HRV from Apple Health."
      );
    } else {
      Alert.alert(
        "Health Access Unavailable",
        "HydraPulse could not connect to Apple Health.\n\n" +
        "If HydraPulse does not appear under Health \u2192 Apps & Sources, the HealthKit capability may need to be enabled in the Apple Developer portal for this app.\n\n" +
        "If the permission was previously denied, tap Open Settings to grant it manually.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => Linking.openSettings(),
          },
        ]
      );
    }
  };

  const handleWatchInterval = async (h: WatchInterval) => {
    if (h > 0) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          "Notifications Required",
          "Enable notifications in iPhone Settings so HydraPulse can alert you about low hydration.",
          [{ text: "OK" }]
        );
        return;
      }
    }
    await setWatchInterval(h);
  };

  const intervalLabel = (h: WatchInterval) => (h === 0 ? "Off" : `Every ${h}h`);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === "web" ? insets.top + 67 : 0,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 100 + (Platform.OS === "web" ? 34 : 0) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.premiumActive,
            { backgroundColor: colors.accent + "15", borderColor: colors.accent + "40" },
          ]}
        >
          <Ionicons name="flask-outline" size={20} color={colors.accent} />
          <Text style={[styles.premiumActiveText, { color: colors.accent }]}>
            Testing Mode — All Features Unlocked
          </Text>
        </View>

        <SectionHeader title="Workout" />
        <View style={styles.group}>
          <SettingsRow
            icon="barbell-outline"
            label="Sweat Loss Tracker"
            value="Start / End Workout"
            onPress={() => router.push("/workout")}
          />
        </View>

        <SectionHeader title="Account" />
        <View style={styles.group}>
          <SettingsRow icon="diamond" label="Premium Plan" value="Unlocked" />
          <SettingsRow icon="bar-chart-outline" label="Total Scans" value={String(history.length)} />
          <SettingsRow icon="scan-outline" label="Scans This Week" value={`${scansThisWeek} / \u221e`} />
        </View>

        <SectionHeader title="Integrations" />
        <View style={styles.group}>
          <SettingsRow
            icon="heart-outline"
            label="Apple Health"
            value={
              Platform.OS !== "ios"
                ? "iOS only"
                : !healthKitAvailable
                ? "Unavailable"
                : healthKitEnabled
                ? "Connected"
                : "Connect"
            }
            onPress={Platform.OS === "ios" ? handleConnectHealth : undefined}
          />
          <SettingsRow
            icon="watch-outline"
            label="Watch Monitoring"
            value={
              Platform.OS !== "ios"
                ? "iOS only"
                : !healthKitEnabled
                ? "Requires Health"
                : intervalLabel(watchInterval)
            }
            onPress={
              Platform.OS === "ios" && healthKitEnabled
                ? () => setShowIntervalPicker(true)
                : Platform.OS === "ios" && !healthKitEnabled
                ? () =>
                    Alert.alert(
                      "Connect Apple Health First",
                      "Tap Apple Health above to grant permission, then set your monitoring interval.",
                      [{ text: "OK" }]
                    )
                : undefined
            }
          />
          <SettingsRow
            icon="notifications-outline"
            label="Smart Reminders"
            value={notificationsEnabled ? "On" : "Off"}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setShowReminders((v) => !v);
            }}
          />
        </View>

        {showReminders && <ReminderToggles />}

        <SectionHeader title="Privacy & Data" />
        <View style={styles.group}>
          <SettingsRow icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => {}} />
          <SettingsRow icon="document-text-outline" label="Terms of Service" onPress={() => {}} />
          <SettingsRow
            icon="trash-outline"
            label="Clear Scan History"
            onPress={handleClearHistory}
            destructive
          />
        </View>

        <SectionHeader title="About" />
        <View style={styles.group}>
          <SettingsRow icon="information-circle-outline" label="Version" value="1.0.0" />
          <SettingsRow
            icon="code-slash-outline"
            label="Mode"
            value="Camera PPG"
          />
        </View>

        <View style={{ marginTop: 8 }}>
          <DisclaimerBanner />
        </View>
      </ScrollView>

      <WatchIntervalPicker
        visible={showIntervalPicker}
        current={watchInterval}
        onSelect={handleWatchInterval}
        onClose={() => setShowIntervalPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  premiumActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 4,
  },
  premiumActiveText: { fontSize: 15, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  group: { borderRadius: 16, overflow: "hidden", gap: 1 },
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
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowValue: { fontSize: 14, fontFamily: "Inter_400Regular" },
  reminderBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginTop: -4,
  },
  reminderTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  reminderSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  reminderSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
  },
  slotLabel: { fontSize: 14, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  slotTime: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 24,
    gap: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  intervalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  intervalOptionText: { fontSize: 16, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
});
