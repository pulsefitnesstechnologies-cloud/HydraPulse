import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

function getTier(total: number): { headline: string; sub: string; color: string } {
  if (total >= 90)
    return { headline: "Legendary hydrator",  sub: `${total} days without missing a scan. Remarkable.`, color: "#F59E0B" };
  if (total >= 60)
    return { headline: "Hydration elite",     sub: `${total} total days of consistency. Keep it up.`,   color: "#10B981" };
  if (total >= 30)
    return { headline: "One month strong",    sub: `${total} days and counting. Your body thanks you.`, color: "#10B981" };
  if (total >= 21)
    return { headline: "3 weeks of habit",    sub: `${total} days not missed. The habit is real now.`,  color: "#0EA5E9" };
  if (total >= 14)
    return { headline: "Two week milestone",  sub: `${total} consecutive scan days. You're on a roll.`, color: "#0EA5E9" };
  return   { headline: "Solid start",         sub: `${total} days without missing a scan. Keep going.`, color: "#0EA5E9" };
}

interface Props {
  totalDays: number;
  visible: boolean;
  onDismiss: () => void;
}

export function WeeklyReward({ totalDays, visible, onDismiss }: Props) {
  const colors = useColors();
  const [countDisplay, setCountDisplay] = useState(0);

  const cardScale   = useRef(new Animated.Value(0.8)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const barProgress = useRef(new Animated.Value(0)).current;
  const countAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    setCountDisplay(0);
    cardScale.setValue(0.8);
    cardOpacity.setValue(0);
    barProgress.setValue(0);
    countAnim.setValue(0);

    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const countId = countAnim.addListener(({ value }) => {
      setCountDisplay(Math.round(value));
    });

    const countTimer = setTimeout(() => {
      Animated.timing(countAnim, {
        toValue: totalDays,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    }, 400);

    const barTimer = setTimeout(() => {
      Animated.timing(barProgress, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: false,
      }).start();
    }, 800);

    const dismissTimer = setTimeout(onDismiss, 5500);

    return () => {
      countAnim.removeListener(countId);
      clearTimeout(countTimer);
      clearTimeout(barTimer);
      clearTimeout(dismissTimer);
    };
  }, [visible, totalDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const tier        = getTier(totalDays);
  const daysInBlock = totalDays % 30 === 0 ? 30 : totalDays % 30;
  const nextMilestone = Math.ceil(Math.max(totalDays, 1) / 30) * 30;

  const barWidth = barProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", `${(daysInBlock / 30) * 100}%`],
  });

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Animated.View
          style={[
            styles.card,
            {
              borderColor: tier.color + "40",
              transform: [{ scale: cardScale }],
              opacity: cardOpacity,
            },
          ]}
        >
          {/* Photo header */}
          <View style={styles.imageWrap}>
            <Image
              source={require("@/assets/images/drinking-water.png")}
              style={styles.image}
              resizeMode="cover"
            />
            <View style={styles.imageFade} />
            <View style={[styles.weeklyBadge, { backgroundColor: tier.color + "e8" }]}>
              <Text style={styles.weeklyBadgeText}>WEEKLY REVIEW</Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={[styles.count, { color: tier.color }]}>{countDisplay}</Text>
            <Text style={[styles.countLabel, { color: tier.color }]}>TOTAL DAYS NOT MISSED</Text>

            <Text style={[styles.headline, { color: colors.foreground }]}>{tier.headline}</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>{tier.sub}</Text>

            <View style={styles.barSection}>
              <View style={styles.barLabels}>
                <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>
                  Progress to {nextMilestone}d
                </Text>
                <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>
                  {daysInBlock} / 30
                </Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                <Animated.View
                  style={[styles.barFill, { backgroundColor: tier.color, width: barWidth }]}
                />
              </View>
            </View>

            <Text style={[styles.dismiss, { color: colors.mutedForeground }]}>Tap to dismiss</Text>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 28,
    backgroundColor: "#0D1520",
    borderWidth: 1,
    overflow: "hidden",
  },
  imageWrap: {
    width: "100%",
    height: 210,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: "#0D1520",
    opacity: 0.85,
  },
  weeklyBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
  },
  weeklyBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    letterSpacing: 1,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingBottom: 28,
    paddingTop: 12,
    gap: 4,
  },
  count: {
    fontSize: 64,
    fontFamily: "Inter_700Bold",
    fontWeight: "900",
    letterSpacing: -3,
    lineHeight: 68,
  },
  countLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: -2,
  },
  headline: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },
  sub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
  barSection: {
    width: "100%",
    marginTop: 10,
  },
  barLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  barTrack: {
    width: "100%",
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  dismiss: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
    opacity: 0.5,
  },
});
