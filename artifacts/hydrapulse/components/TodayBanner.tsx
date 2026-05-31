import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
} from "react-native-svg";

import { useColors } from "@/hooks/useColors";

// ─── Drop geometry ─────────────────────────────────────────────────────────────

const DROP_W  = 180;
const DROP_H  = 220;
const DROP_R  = 90;
const DROP_CX = 90;
const DROP_CY = 130; // centre-Y of the circular bottom arc

// Ring sits centred on (DROP_CX, DROP_CY)
const RING_SIZE   = 140;
const RING_STROKE = 10;

// ─── Path builders ─────────────────────────────────────────────────────────────

function buildDropPath(): string {
  const { cx, r } = { cx: DROP_CX, r: DROP_R };
  const W = DROP_W, H = DROP_H, cy = DROP_CY;
  return (
    `M ${cx} 6 ` +
    `C ${W * 0.70} ${H * 0.06} ${W} ${H * 0.26} ${W} ${cy} ` +
    `A ${r} ${r} 0 0 1 0 ${cy} ` +
    `C 0 ${H * 0.26} ${W * 0.30} ${H * 0.06} ${cx} 6 Z`
  );
}

// Wave-fill path: extends 24 px beyond each side so translateX slosh
// never exposes a gap inside the drop clip.
function buildWaveFill(amp: number): string {
  const L = -24;              // left overhang
  const R = DROP_W + 24;      // right overhang
  const mid = DROP_W / 2;
  return [
    `M ${L} ${amp}`,
    `C ${mid * 0.5} 0 ${mid * 1.5} ${amp * 2} ${R} ${amp}`,
    `V ${DROP_H + 20} H ${L} Z`,
  ].join(" ");
}

// ─── Animated components ───────────────────────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// react-native-svg's GProps doesn't declare `style`, but the native
// implementation honours React Native style transforms at runtime.
// Cast through unknown so TypeScript doesn't block the valid style prop.
const AnimatedG = Animated.createAnimatedComponent(G) as unknown as React.ComponentType<{
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}>;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TodayBannerProps {
  todayScans:    number;
  currentStreak: number;
  bestStreak:    number;
  todayTotalOz:  number;
  dailyGoalOz:   number;
  onLogWater:    () => void;
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

  const progress   = Math.min(Math.max(todayTotalOz / Math.max(dailyGoalOz, 1), 0), 1);
  const done       = todayTotalOz >= dailyGoalOz;
  const waterColor = done ? "#10B981" : "#0EA5E9";
  const pct        = Math.round(progress * 100);
  const ozDisplay  = todayTotalOz % 1 === 0
    ? String(todayTotalOz)
    : todayTotalOz.toFixed(1);

  // ── Progress ring ───────────────────────────────────────────────────────────
  const rInner       = RING_SIZE / 2 - RING_STROKE;
  const circumference = rInner * 2 * Math.PI;
  const ringAnim     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(ringAnim, {
      toValue: progress,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const strokeDashoffset = ringAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [circumference, 0],
  });

  // ── Drop fill: wave Y positions use direct Animated.Values (numeric props
  //    on AnimatedG — string transform interpolation is not reliably animated
  //    in react-native-svg, but numeric x/y props are).
  //    wave1YAnim / wave2YAnim: start at bottom (empty), rise to fill level.
  //    sloshAnim: oscillates -14 → +14 → -14 for horizontal slosh.
  const wave1YAnim = useRef(new Animated.Value(DROP_H - 12)).current;
  const wave2YAnim = useRef(new Animated.Value(DROP_H - 6)).current;

  useEffect(() => {
    const target = DROP_H * (1 - Math.max(progress, 0.04));
    Animated.parallel([
      Animated.timing(wave1YAnim, {
        toValue: target - 12,
        duration: 1600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(wave2YAnim, {
        toValue: target - 6,
        duration: 1600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [progress]);

  // ── Horizontal slosh: starts 100 ms after fill completes ──────────────────
  const sloshAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(sloshAnim, {
            toValue: 14,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(sloshAnim, {
            toValue: -14,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      ).start();
    }, 1700);
    return () => clearTimeout(timer);
  }, []);

  // Wave 2 uses a slightly smaller slosh amplitude for depth
  const slosh2Anim = sloshAnim.interpolate({
    inputRange:  [-14, 14],
    outputRange: [-10, 10],
  });

  const streakEmoji = currentStreak > 0 &&
    [30, 14, 7].some((n) => currentStreak >= n && currentStreak % n === 0)
      ? "🌊" : "💧";

  const dropPath  = buildDropPath();
  const waveFill1 = buildWaveFill(10);
  const waveFill2 = buildWaveFill(7);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.content}>

        {/* ── Drop hero: fill animation + ring ─────────────────────────── */}
        <View style={styles.dropHero}>
          {/* SVG: drop background + clipped water fill */}
          <Svg width={DROP_W} height={DROP_H}>
            <Defs>
              <ClipPath id="drop-clip-tb">
                <Path d={dropPath} />
              </ClipPath>
            </Defs>

            {/* Empty drop background */}
            <Path d={dropPath} fill={`${waterColor}16`} />

            {/* Water fill clipped to drop shape.
                AnimatedG uses style.transform (React Native animation path) —
                x/y SVG attributes are NOT animated by Animated.Value in
                react-native-svg; style transforms are. */}
            <G clipPath="url(#drop-clip-tb)">
              {/* Wave 2 — behind, smaller x-slosh amplitude */}
              <AnimatedG
                style={{
                  transform: [
                    { translateX: slosh2Anim as unknown as number },
                    { translateY: wave2YAnim as unknown as number },
                  ],
                }}
              >
                <Path d={waveFill2} fill={`${waterColor}40`} />
              </AnimatedG>
              {/* Wave 1 — front, full x-slosh amplitude */}
              <AnimatedG
                style={{
                  transform: [
                    { translateX: sloshAnim as unknown as number },
                    { translateY: wave1YAnim as unknown as number },
                  ],
                }}
              >
                <Path d={waveFill1} fill={`${waterColor}70`} />
              </AnimatedG>
            </G>

            {/* Drop border — static */}
            <Path
              d={dropPath}
              fill="none"
              stroke={waterColor}
              strokeWidth={2}
              strokeOpacity={0.7}
            />
          </Svg>

          {/* Ring overlay — centred on DROP_CY */}
          <View style={styles.ringOverlay} pointerEvents="none">
            <Svg
              width={RING_SIZE}
              height={RING_SIZE}
              style={{ transform: [{ rotate: "-90deg" }] }}
            >
              {/* Track */}
              <Circle
                stroke="#ffffff"
                fill="transparent"
                strokeWidth={RING_STROKE}
                strokeOpacity={0.22}
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
            {/* Centre label */}
            <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
              <Text style={[styles.ringOz, { color: colors.foreground }]}>
                {ozDisplay}
              </Text>
              <Text style={[styles.ringGoalLabel, { color: colors.mutedForeground }]}>
                / {dailyGoalOz} oz
              </Text>
            </View>
          </View>
        </View>

        {/* ── Percentage ────────────────────────────────────────────────── */}
        <Text style={[styles.pctText, { color: waterColor }]}>{pct}%</Text>
        <Text style={[styles.pctSub, { color: colors.mutedForeground }]}>
          of daily goal
        </Text>

        {/* ── Stats row ─────────────────────────────────────────────────── */}
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

        {/* ── Log Water button ──────────────────────────────────────────── */}
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
  // Auto-height card — no fixed height, overflow:hidden for border-radius only
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },

  content: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 10,
  },

  // Drop hero container
  dropHero: {
    width: DROP_W,
    height: DROP_H,
  },

  // Ring sits centred on DROP_CY
  ringOverlay: {
    position:  "absolute",
    width:     RING_SIZE,
    height:    RING_SIZE,
    top:       DROP_CY - RING_SIZE / 2,   // 130 - 70 = 60
    left:      DROP_CX - RING_SIZE / 2,   // 90  - 70 = 20
  },
  ringCenter: {
    alignItems:     "center",
    justifyContent: "center",
  },
  ringOz: {
    fontSize:   26,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    lineHeight: 30,
  },
  ringGoalLabel: {
    fontSize:   12,
    fontFamily: "Inter_400Regular",
    marginTop:  2,
  },

  // Percentage
  pctText: {
    fontSize:      38,
    fontFamily:    "Inter_700Bold",
    fontWeight:    "700",
    lineHeight:    44,
    letterSpacing: -1,
    marginTop:     -4,
  },
  pctSub: {
    fontSize:      11,
    fontFamily:    "Inter_400Regular",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop:     -4,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    alignItems:    "center",
    width:         "100%",
    marginTop:     4,
  },
  statLeft:  { flex: 1, gap: 2 },
  statRight: { alignItems: "flex-end", gap: 3 },
  streakRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  streakNum: {
    fontSize:   26,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    lineHeight: 30,
  },
  streakEmoji: { fontSize: 22, lineHeight: 26 },
  streakLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  scanBadge: {
    fontSize:   13,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
  },
  bestText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  // Log Water button
  logBtn: {
    width:          "100%",
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            8,
    paddingVertical: 14,
    borderRadius:   16,
    marginTop:      4,
  },
  logBtnText: {
    color:      "#fff",
    fontSize:   16,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
  },
});
