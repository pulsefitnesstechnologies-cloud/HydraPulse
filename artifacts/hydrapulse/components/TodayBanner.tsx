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
import Svg, {
  Circle,
  Defs,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";

import { useColors } from "@/hooks/useColors";

// ─── Layout ────────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_H     = 360;
const RING_SIZE  = 160;
const RING_STROKE = 10;

// Decorative drop proportions — sized to sit naturally behind the ring
const DROP_W  = 210;
const DROP_H  = 230;
const DROP_R  = DROP_W / 2;
const DROP_CX = DROP_W / 2;
const DROP_CY = DROP_H - DROP_R; // centre-Y of bottom arc

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDropPath(): string {
  const cx = DROP_CX, W = DROP_W, H = DROP_H, cy = DROP_CY, r = DROP_R;
  return (
    `M ${cx} 6 ` +
    `C ${W * 0.70} ${H * 0.06} ${W} ${H * 0.26} ${W} ${cy} ` +
    `A ${r} ${r} 0 0 1 0 ${cy} ` +
    `C 0 ${H * 0.26} ${W * 0.30} ${H * 0.06} ${cx} 6 Z`
  );
}

// Wave surface: renders across the full card width with a gentle crest.
// Two periods drawn so a horizontal translateX loop is seamless if ever needed.
function buildWavePath(amp: number): string {
  const W = SCREEN_W + 40; // slight overhang to avoid edge clipping
  const y = amp;
  return [
    `M 0 ${y}`,
    `C ${W * 0.25} 0 ${W * 0.75} ${y * 2} ${W} ${y}`,
    `C ${W * 1.25} 0 ${W * 1.75} ${y * 2} ${W * 2} ${y}`,
    `V 40 H 0 Z`,
  ].join(" ");
}

// Animated Circle for the progress ring
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TodayBannerProps {
  todayScans:     number;
  currentStreak:  number;
  bestStreak:     number;
  todayTotalOz:   number;
  dailyGoalOz:    number;
  onLogWater:     () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TodayBanner({
  todayScans,
  currentStreak,
  bestStreak,
  todayTotalOz,
  dailyGoalOz,
  onLogWater,
}: TodayBannerProps) {
  const colors = useColors();

  // Clamp progress 0-1; keep a 2 % floor so the fill ring is never invisible
  const progress   = Math.min(Math.max(todayTotalOz / Math.max(dailyGoalOz, 1), 0), 1);
  const done       = todayTotalOz >= dailyGoalOz;
  const waterColor = done ? "#10B981" : "#0EA5E9";
  const pct        = Math.round(progress * 100);
  const ozDisplay  = todayTotalOz % 1 === 0
    ? String(todayTotalOz)
    : todayTotalOz.toFixed(1);

  // ── Progress ring ──────────────────────────────────────────────────────────
  const rInner      = RING_SIZE / 2 - RING_STROKE;
  const circumference = rInner * 2 * Math.PI;
  const ringAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(ringAnim, {
      toValue: progress,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // SVG props cannot use native driver
    }).start();
  }, [progress]);

  const strokeDashoffset = ringAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [circumference, 0],
  });

  // ── Fill rise: animates the height of an absolutely-positioned bottom view ─
  const fillHeightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fillHeightAnim, {
      toValue: Math.max(progress * CARD_H, 8),
      duration: 1600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // height cannot use native driver
    }).start();
  }, [progress]);

  // ── Wave bob: starts once the fill animation completes ────────────────────
  const bobAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bobAnim, {
            toValue: -5,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bobAnim, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, 1700); // 100 ms after fill ends
    return () => clearTimeout(timer);
  }, []);

  // ── Derived display ────────────────────────────────────────────────────────
  const streakEmoji = currentStreak > 0 &&
    [30, 14, 7].some((n) => currentStreak >= n && currentStreak % n === 0)
      ? "🌊" : "💧";

  const dropPath  = buildDropPath();
  const wavePath1 = buildWavePath(9);
  const wavePath2 = buildWavePath(6);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* ── 1. Decorative drop watermark ─────────────────────────────────── */}
      <View style={styles.dropWrap} pointerEvents="none">
        <Svg width={DROP_W} height={DROP_H} style={{ opacity: 0.30 }}>
          <Defs>
            <RadialGradient id="tb-drop-grad" cx="50%" cy="45%" r="55%">
              <Stop offset="0%"   stopColor="#38BDF8" stopOpacity={0.6} />
              <Stop offset="60%"  stopColor="#0EA5E9" stopOpacity={0.3} />
              <Stop offset="100%" stopColor="#075985" stopOpacity={0.05} />
            </RadialGradient>
          </Defs>
          <Path d={dropPath} fill="url(#tb-drop-grad)" />
          <Path d={dropPath} fill="none"
                stroke="#38BDF8" strokeWidth={1.5} strokeOpacity={0.25} />
        </Svg>
      </View>

      {/* ── 2. Rising fill: grows from bottom up to progress level ───────── */}
      <Animated.View
        style={[styles.fillWrap, { height: fillHeightAnim }]}
        pointerEvents="none"
      >
        {/* Animated wave surface rides on the bobAnim */}
        <Animated.View
          style={[styles.waveSurface, { transform: [{ translateY: bobAnim }] }]}
        >
          <Svg width={SCREEN_W} height={40}
               style={[StyleSheet.absoluteFill, { top: -10 }]}>
            <Path d={wavePath1} fill={`${waterColor}55`} />
          </Svg>
          <Svg width={SCREEN_W} height={40}
               style={[StyleSheet.absoluteFill, { top: -4, opacity: 0.55 }]}>
            <Path d={wavePath2} fill={`${waterColor}40`} />
          </Svg>
        </Animated.View>

        {/* Solid fill body — sits below the wave */}
        <View style={[styles.fillBody, { backgroundColor: waterColor }]} />
      </Animated.View>

      {/* ── 3. Foreground content ─────────────────────────────────────────── */}
      <View style={styles.content}>

        {/* Progress ring */}
        <View style={styles.ringWrap}>
          <Svg
            width={RING_SIZE}
            height={RING_SIZE}
            style={{ transform: [{ rotate: "-90deg" }] }}
          >
            {/* Track */}
            <Circle
              stroke={colors.border}
              fill="transparent"
              strokeWidth={RING_STROKE}
              r={rInner}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
            />
            {/* Progress arc */}
            <AnimatedCircle
              stroke={waterColor}
              fill="transparent"
              strokeWidth={RING_STROKE}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeLinecap="round"
              strokeDashoffset={strokeDashoffset}
              r={rInner}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
            />
          </Svg>
          {/* Centre: oz count */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.ringCenter}>
              <Text style={[styles.ringOz, { color: colors.foreground }]}>
                {ozDisplay}
              </Text>
              <Text style={[styles.ringGoalLabel, { color: colors.mutedForeground }]}>
                / {dailyGoalOz} oz
              </Text>
            </View>
          </View>
        </View>

        {/* Percentage */}
        <Text style={[styles.pctText, { color: waterColor }]}>{pct}%</Text>
        <Text style={[styles.pctSub, { color: colors.mutedForeground }]}>
          of daily goal
        </Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statLeft}>
            <View style={styles.streakRow}>
              <Text
                style={[
                  styles.streakNum,
                  { color: currentStreak > 0 ? "#10B981" : colors.mutedForeground },
                ]}
              >
                {currentStreak}
              </Text>
              <Text style={styles.streakEmoji}>{streakEmoji}</Text>
            </View>
            <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>
              Day Streak
            </Text>
          </View>
          <View style={styles.statRight}>
            <Text
              style={[
                styles.scanBadge,
                { color: todayScans > 0 ? "#10B981" : colors.primary },
              ]}
            >
              {todayScans > 0 ? "Scanned today" : "No scan yet"}
            </Text>
            <Text style={[styles.bestText, { color: colors.mutedForeground }]}>
              Best: {bestStreak} {bestStreak === 1 ? "day" : "days"}
            </Text>
          </View>
        </View>

        {/* Log Water button */}
        <Pressable
          style={({ pressed }) => [
            styles.logBtn,
            { backgroundColor: waterColor, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={onLogWater}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.logBtnText}>Log Water</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    height: CARD_H,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },

  // Decorative drop glow behind ring
  dropWrap: {
    position: "absolute",
    top: 14,
    alignSelf: "center",
    left: (SCREEN_W - 40 - DROP_W) / 2, // 40 = 2× paddingHorizontal
  },

  // Rising water fill
  fillWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  waveSurface: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  fillBody: {
    position: "absolute",
    top: 20,
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.16,
  },

  // Content sits on top of fill + drop
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 0,
    zIndex: 1,
  },

  // Ring
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    marginBottom: 10,
  },
  ringCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ringOz: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    lineHeight: 32,
  },
  ringGoalLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },

  // Percentage
  pctText: {
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    lineHeight: 48,
    letterSpacing: -1,
  },
  pctSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 16,
    marginTop: 3,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
  },
  statLeft: {
    flex: 1,
    gap: 2,
  },
  statRight: {
    alignItems: "flex-end",
    gap: 3,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  streakNum: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    lineHeight: 30,
  },
  streakEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  streakLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  scanBadge: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
  },
  bestText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },

  // Log Water button
  logBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  logBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
  },
});
