import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface EmptyStateAction {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}

interface EmptyStateProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor?: string;
  title: string;
  subtitle: string;
  action?: EmptyStateAction;
  compact?: boolean;
}

export function EmptyState({
  icon,
  iconColor,
  title,
  subtitle,
  action,
  compact = false,
}: EmptyStateProps) {
  const colors = useColors();
  const tint = iconColor ?? colors.primary;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={[styles.iconCircle, { backgroundColor: tint + "15" }]}>
        <Ionicons name={icon} size={compact ? 30 : 38} color={tint} />
      </View>

      <Text style={[styles.title, { color: colors.foreground }, compact && styles.titleCompact]}>
        {title}
      </Text>

      <Text style={[styles.subtitle, { color: colors.mutedForeground }, compact && styles.subtitleCompact]}>
        {subtitle}
      </Text>

      {action && (
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: tint, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
          onPress={action.onPress}
        >
          {action.icon && (
            <Ionicons name={action.icon} size={16} color="#fff" />
          )}
          <Text style={styles.btnText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 12,
  },
  wrapCompact: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 10,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
    textAlign: "center",
  },
  titleCompact: {
    fontSize: 17,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
  },
  subtitleCompact: {
    fontSize: 13,
    lineHeight: 19,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 4,
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
});
