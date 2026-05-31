import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

const MILESTONE_MESSAGES: Record<number, { headline: string; sub: string }> = {
  3:  { headline: "3 days in a row!",     sub: "You're building a real habit." },
  7:  { headline: "One full week!",        sub: "Consistency is paying off." },
  14: { headline: "Two weeks strong!",     sub: "Your body is thanking you." },
  30: { headline: "30 day streak!",        sub: "Elite-level consistency." },
};

interface StreakCelebrationProps {
  streak: number;
  visible: boolean;
  onDismiss: () => void;
}

export function StreakCelebration({ streak, visible, onDismiss }: StreakCelebrationProps) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(0.75)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.75);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      const timer = setTimeout(onDismiss, 3200);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const msg = MILESTONE_MESSAGES[streak] ?? {
    headline: `${streak} day streak!`,
    sub: "Keep scanning every day.",
  };

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: "#10B981" + "40", transform: [{ scale }], opacity },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: "#10B981" + "18" }]}>
            <Ionicons name="flame" size={36} color="#10B981" />
          </View>
          <Text style={[styles.streak, { color: "#10B981" }]}>{streak}</Text>
          <Text style={[styles.heading, { color: colors.foreground }]}>{msg.headline}</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>{msg.sub}</Text>
          <Text style={[styles.dismiss, { color: colors.mutedForeground }]}>Tap to dismiss</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  card: {
    width: "100%",
    borderRadius: 28,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  streak: {
    fontSize: 56,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    lineHeight: 62,
  },
  heading: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  dismiss: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    opacity: 0.6,
  },
});
