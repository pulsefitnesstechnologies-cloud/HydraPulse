import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface PremiumModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

const FEATURES = [
  { icon: "infinite-outline" as const, label: "Unlimited scans per week" },
  { icon: "watch-outline" as const, label: "Apple Watch integration" },
  { icon: "trending-up-outline" as const, label: "Advanced trend analytics" },
  { icon: "notifications-outline" as const, label: "Smart hydration reminders" },
  { icon: "shield-checkmark-outline" as const, label: "Priority support" },
];

export function PremiumModal({ visible, onClose, onUpgrade }: PremiumModalProps) {
  const colors = useColors();

  const handleUpgrade = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onUpgrade();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.mutedForeground} />
          </Pressable>

          <View style={[styles.badge, { backgroundColor: colors.accent + "20" }]}>
            <Ionicons name="diamond-outline" size={28} color={colors.accent} />
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>
            HydraPulse Premium
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Unlock your full hydration potential
          </Text>

          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.label} style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: colors.primary + "20" }]}>
                  <Ionicons name={f.icon} size={18} color={colors.primary} />
                </View>
                <Text style={[styles.featureLabel, { color: colors.foreground }]}>
                  {f.label}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.pricing}>
            <Text style={[styles.price, { color: colors.foreground }]}>$4.99</Text>
            <Text style={[styles.period, { color: colors.mutedForeground }]}>/month</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.upgradeBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleUpgrade}
          >
            <Text style={[styles.upgradeBtnText, { color: colors.primaryForeground }]}>
              Start Free Trial
            </Text>
          </Pressable>

          <Text style={[styles.legal, { color: colors.mutedForeground }]}>
            7-day free trial, then $4.99/month. Cancel anytime.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: Platform.OS === "ios" ? 48 : 28,
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 20,
    padding: 8,
  },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 24,
  },
  features: {
    width: "100%",
    gap: 14,
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
  },
  pricing: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginBottom: 20,
  },
  price: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
  },
  period: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  upgradeBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  upgradeBtnText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  legal: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
