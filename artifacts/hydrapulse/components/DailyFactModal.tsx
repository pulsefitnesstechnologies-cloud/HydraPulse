import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WaterFact } from "@/data/waterFacts";
import { useColors } from "@/hooks/useColors";

const CATEGORY_ICONS: Record<WaterFact["category"], keyof typeof Ionicons.glyphMap> = {
  Body:        "body-outline",
  Brain:       "bulb-outline",
  Performance: "flash-outline",
  Science:     "flask-outline",
  Habit:       "leaf-outline",
};

interface Props {
  visible: boolean;
  fact: WaterFact | null;
  onDismiss: () => void;
}

export function DailyFactModal({ visible, fact, onDismiss }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  if (!fact) return null;

  const icon = CATEGORY_ICONS[fact.category];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss} />
      <View style={styles.centeredView}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              marginBottom: insets.bottom + 32,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primary + "20" }]}>
              <Ionicons name="water-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
                Did you know?
              </Text>
              <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
                {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Fact text */}
          <Text style={[styles.factText, { color: colors.foreground }]}>
            {fact.fact}
          </Text>

          {/* Category badge */}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
              <Ionicons name={icon} size={12} color={colors.primary} />
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                {fact.category}
              </Text>
            </View>
          </View>

          {/* Dismiss button */}
          <Pressable
            style={({ pressed }) => [
              styles.dismissBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={onDismiss}
          >
            <Text style={[styles.dismissText, { color: colors.primaryForeground }]}>
              Got it
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  centeredView: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { gap: 2 },
  eyebrow: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  dateLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  divider: { height: 1 },
  factText: {
    fontSize: 17,
    fontFamily: "Inter_500Medium",
    fontWeight: "500",
    lineHeight: 26,
  },
  badgeRow: { flexDirection: "row" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontFamily: "Inter_500Medium", fontWeight: "500" },
  dismissBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  dismissText: { fontSize: 16, fontFamily: "Inter_600SemiBold", fontWeight: "600" },
});
