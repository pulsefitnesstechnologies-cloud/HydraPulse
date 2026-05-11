import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { PremiumModal } from "@/components/PremiumModal";
import {
  FREE_SCANS_PER_WEEK,
  ScanMethod,
  useHydration,
} from "@/context/HydrationContext";
import { useColors } from "@/hooks/useColors";

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

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    isPremium,
    setIsPremium,
    scanMode,
    setScanMode,
    scansThisWeek,
    history,
    clearHistory,
  } = useHydration();

  const [showPremium, setShowPremium] = useState(false);

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
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            ).catch(() => {});
          },
        },
      ]
    );
  };

  const handleUpgrade = async () => {
    await setIsPremium(true);
    setShowPremium(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
  };

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
          {
            paddingBottom:
              insets.bottom + 100 + (Platform.OS === "web" ? 34 : 0),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!isPremium && (
          <Pressable
            style={({ pressed }) => [
              styles.premiumBanner,
              {
                backgroundColor: colors.primary + "15",
                borderColor: colors.primary + "40",
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={() => setShowPremium(true)}
          >
            <View style={styles.premiumBannerLeft}>
              <Ionicons name="diamond-outline" size={28} color={colors.primary} />
              <View>
                <Text style={[styles.premiumBannerTitle, { color: colors.foreground }]}>
                  Upgrade to Premium
                </Text>
                <Text style={[styles.premiumBannerSub, { color: colors.mutedForeground }]}>
                  {`${scansThisWeek}/${FREE_SCANS_PER_WEEK} free scans used this week`}
                </Text>
              </View>
            </View>
            <View style={[styles.upgradeTag, { backgroundColor: colors.primary }]}>
              <Text style={[styles.upgradeTagText, { color: colors.primaryForeground }]}>
                Upgrade
              </Text>
            </View>
          </Pressable>
        )}

        {isPremium && (
          <View
            style={[
              styles.premiumActive,
              { backgroundColor: colors.accent + "15", borderColor: colors.accent + "40" },
            ]}
          >
            <Ionicons name="diamond" size={20} color={colors.accent} />
            <Text style={[styles.premiumActiveText, { color: colors.accent }]}>
              Premium Active
            </Text>
          </View>
        )}

        <SectionHeader title="Scan Settings" />
        <View style={styles.group}>
          <SettingsRow
            icon="flask-outline"
            label="Simulation Mode"
            right={
              <Switch
                value={scanMode === "simulation"}
                onValueChange={(v) => setScanMode(v ? "simulation" : "phone")}
                trackColor={{
                  false: colors.border,
                  true: colors.primary + "80",
                }}
                thumbColor={scanMode === "simulation" ? colors.primary : colors.mutedForeground}
              />
            }
          />
          <SettingsRow
            icon="camera-outline"
            label="Camera Mode"
            right={
              <Switch
                value={scanMode === "phone"}
                onValueChange={(v) => setScanMode(v ? "phone" : "simulation")}
                trackColor={{
                  false: colors.border,
                  true: colors.primary + "80",
                }}
                thumbColor={scanMode === "phone" ? colors.primary : colors.mutedForeground}
              />
            }
          />
        </View>

        <SectionHeader title="Account" />
        <View style={styles.group}>
          {!isPremium ? (
            <SettingsRow
              icon="diamond-outline"
              label="Upgrade to Premium"
              onPress={() => setShowPremium(true)}
            />
          ) : (
            <SettingsRow
              icon="diamond"
              label="Premium Plan"
              value="Active"
            />
          )}
          <SettingsRow
            icon="bar-chart-outline"
            label="Total Scans"
            value={String(history.length)}
          />
          <SettingsRow
            icon="scan-outline"
            label="Scans This Week"
            value={`${scansThisWeek} / ${isPremium ? "∞" : FREE_SCANS_PER_WEEK}`}
          />
        </View>

        <SectionHeader title="Integrations" />
        <View style={styles.group}>
          <SettingsRow
            icon="watch-outline"
            label="Apple Watch"
            value={isPremium ? "Connect" : "Premium"}
            onPress={isPremium ? () => {} : () => setShowPremium(true)}
          />
          <SettingsRow
            icon="heart-outline"
            label="Apple Health"
            value={isPremium ? "Connect" : "Premium"}
            onPress={isPremium ? () => {} : () => setShowPremium(true)}
          />
          <SettingsRow
            icon="notifications-outline"
            label="Smart Reminders"
            value={isPremium ? "Configure" : "Premium"}
            onPress={isPremium ? () => {} : () => setShowPremium(true)}
          />
        </View>

        <SectionHeader title="Privacy & Data" />
        <View style={styles.group}>
          <SettingsRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => {}}
          />
          <SettingsRow
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => {}}
          />
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
          <SettingsRow icon="code-slash-outline" label="Mode" value="Simulation" />
        </View>

        <View style={{ marginTop: 8 }}>
          <DisclaimerBanner />
        </View>
      </ScrollView>

      <PremiumModal
        visible={showPremium}
        onClose={() => setShowPremium(false)}
        onUpgrade={handleUpgrade}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  premiumBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 4,
  },
  premiumBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  premiumBannerTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  premiumBannerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  upgradeTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  upgradeTagText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  premiumActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 4,
  },
  premiumActiveText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
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
  group: {
    borderRadius: 16,
    overflow: "hidden",
    gap: 1,
  },
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
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowValue: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
