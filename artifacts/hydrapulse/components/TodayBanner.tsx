import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

// ─── Layout constants ─────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_HEIGHT = 168;
const WAVE_AMP = 10;
// The SVG is 2× the card width; we animate translateX by −cardWidth for a
// seamless, perfectly repeating loop.
const SVG_WIDTH = SCREEN_WIDTH * 2;

// ─── Wave path ────────────────────────────────────────────────────────────────
// Approximates a sine wave using cubic bezier curves.
// Two full periods drawn so the loop is seamless when we shift by one period.

function buildWavePath(waveY: number): string {
  const w = SCREEN_WIDTH;
  const a = WAVE_AMP;
  const h = CARD_HEIGHT;
  // Control-point fraction that produces a smooth sine-like curve (~0.36)
  const cp = 0.36;
  const hW = w / 2; // half-period = half screen width

  return [
    `M 0 ${waveY}`,
    `C ${hW * cp} ${waveY - a}, ${hW * (1 - cp)} ${waveY - a}, ${hW} ${waveY}`,
    `C ${hW * (1 + cp)} ${waveY + a}, ${hW * (2 - cp)} ${waveY + a}, ${w} ${waveY}`,
    `C ${w + hW * cp} ${waveY - a}, ${w + hW * (1 - cp)} ${waveY - a}, ${w + hW} ${waveY}`,
    `C ${w + hW * (1 + cp)} ${waveY + a}, ${w + hW * (2 - cp)} ${waveY + a}, ${SVG_WIDTH} ${waveY}`,
    `V ${h} H 0 Z`,
  ].join(" ");
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface TodayBannerProps {
  todayScans: number;
  currentStreak: number;
  bestStreak: number;
  todayTotalOz: number;
  dailyGoalOz: number;
  onLogWater: () => void;
}

export function TodayBanner({
  todayScans,
  currentStreak,
  bestStreak,
  todayTotalOz,
  dailyGoalOz,
  onLogWater,
}: TodayBannerProps) {
  const colors = useColors();

  // Progress: clamp 0–1, keep a 5% minimum so there's always a sliver visible
  const progress = Math.min(Math.max(todayTotalOz / Math.max(dailyGoalOz, 1), 0.05), 1);
  const fillHeight = progress * CARD_HEIGHT;
  // waveY is the distance from the TOP of the card to where the wave centre sits
  const waveY = CARD_HEIGHT - fillHeight;

  // ── Wave animation ────────────────────────────────────────────────────────
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: -SCREEN_WIDTH,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [waveAnim]);

  const wavePath = buildWavePath(waveY);

  // ── Derived display values ────────────────────────────────────────────────
  const done = todayTotalOz >= dailyGoalOz;
  const waterColor = done ? "#10B981" : "#0EA5E9";
  const fillOpacity = 0.38;

  const ozDisplay =
    todayTotalOz % 1 === 0 ? String(todayTotalOz) : todayTotalOz.toFixed(1);
  const pct = Math.round(progress * 100);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* ── Animated water fill ─────────────────────────────────────────── */}
      <Animated.View
        style={[styles.waveWrap, { transform: [{ translateX: waveAnim }] }]}
      >
        <Svg width={SVG_WIDTH} height={CARD_HEIGHT}>
          <Path
            d={wavePath}
            fill={`${waterColor}${Math.round(fillOpacity * 255)
              .toString(16)
              .padStart(2, "0")}`}
          />
        </Svg>
      </Animated.View>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <View style={styles.content}>
        {/* Left — streak */}
        <View style={styles.col}>
          <View style={styles.streakRow}>
            <Text
              style={[
                styles.streakNum,
                { color: currentStreak > 0 ? "#10B981" : colors.mutedForeground },
              ]}
            >
              {currentStreak}
            </Text>
            <View>
              <Text style={[styles.streakUnit, { color: colors.foreground }]}>
                {currentStreak === 1 ? "day" : "days"}
              </Text>
              <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>
                streak
              </Text>
            </View>
          </View>
          <Text style={[styles.bestText, { color: colors.mutedForeground }]}>
            Best: {bestStreak} {bestStreak === 1 ? "day" : "days"}
          </Text>
          <Text
            style={[
              styles.scanBadge,
              { color: todayScans > 0 ? "#10B981" : colors.primary },
            ]}
          >
            {todayScans > 0 ? "Scanned today" : "No scan yet"}
          </Text>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border + "80" }]} />

        {/* Right — water */}
        <View style={styles.col}>
          <View style={styles.waterRow}>
            <Ionicons name="water" size={16} color={waterColor} />
            <Text style={[styles.waterOz, { color: done ? "#10B981" : colors.foreground }]}>
              {ozDisplay}
            </Text>
            <Text style={[styles.waterGoal, { color: colors.mutedForeground }]}>
              / {dailyGoalOz} oz
            </Text>
          </View>
          <Text style={[styles.waterPct, { color: waterColor }]}>
            {pct}% of daily goal
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.logBtn,
              { backgroundColor: waterColor + "20", borderColor: waterColor + "40", opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={onLogWater}
          >
            <Ionicons name="add" size={15} color={waterColor} />
            <Text style={[styles.logBtnText, { color: waterColor }]}>Log Water</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  waveWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 0,
    zIndex: 1,
  },
  col: {
    flex: 1,
    gap: 4,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  streakNum: {
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    lineHeight: 50,
  },
  streakUnit: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    lineHeight: 18,
  },
  streakLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  bestText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  scanBadge: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    fontWeight: "500",
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 80,
    marginHorizontal: 16,
  },
  waterRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  waterOz: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    lineHeight: 34,
  },
  waterGoal: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  waterPct: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  logBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  logBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
  },
});
