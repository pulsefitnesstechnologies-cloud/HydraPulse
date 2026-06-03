import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
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

// Builds a wave-fill path with ABSOLUTE coordinates so no <G transform> is
// needed. react-native-svg reliably re-renders leaf-element `d` prop changes
// (same mechanism as AnimatedCircle strokeDashoffset) but does NOT reliably
// propagate transform-string updates on container <G> elements.
//
// fillY  — Y position of the wave baseline in the SVG coordinate system
//          (0 = top of drop → full; DROP_H = bottom → empty)
// sloshX — lateral offset; wave bezier control points shift left/right
// amp    — half-amplitude of the sine crest/trough in pixels
function buildWavePath(fillY: number, sloshX: number, amp: number): string {
  const L   = -24;            // left overhang (ensures no gap during slosh)
  const R   = DROP_W + 24;    // right overhang
  const mid = DROP_W / 2;
  const bot = DROP_H * 2;     // well below clip boundary — clip handles it
  const sx  = sloshX;
  // Anchors (M start and bezier endpoint) stay at fixed L/R so the closing
  // edge is always a clean vertical — no diagonal gap at top corners when
  // the wave sloshes left or right. Only the bezier control points carry sx.
  return [
    `M ${L} ${(fillY + amp).toFixed(1)}`,
    `C ${(mid * 0.5 + sx).toFixed(1)} ${fillY.toFixed(1)}`,
    `  ${(mid * 1.5 + sx).toFixed(1)} ${(fillY + amp * 2).toFixed(1)}`,
    `  ${R} ${(fillY + amp).toFixed(1)}`,
    `V ${bot} H ${L} Z`,
  ].join(" ");
}

// ─── Animated components (ring only — waves are driven by RAF state) ──────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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

  // ── Drop fill + slosh: state-driven via requestAnimationFrame ───────────────
  //
  // react-native-svg's G element does NOT support React Native Animated values
  // on either x/y props or style.transform — those are View-only in RN. The
  // only reliable way to animate SVG children is to write the SVG `transform`
  // attribute as a plain string and update it via React state.
  //
  // We keep a mutable ref for the running animation values (avoids stale
  // closures inside the RAF callback), and batch all three wave params into
  // one setState call per frame so there is exactly ONE re-render per tick.

  const targetYRef = useRef(DROP_H);                // updated whenever progress changes
  const waveRef    = useRef({ y1: DROP_H, y2: DROP_H + 6, mountTime: Date.now() });
  const [wave, setWave] = useState({ x1: 0, y1: DROP_H, x2: 0, y2: DROP_H + 6 });

  // Keep target in sync with the latest fill level.
  // Minimum 45% centres the water surface in the wide belly of the teardrop
  // so the fill level and slosh wave are prominently visible at a glance.
  useEffect(() => {
    targetYRef.current = DROP_H * (1 - Math.max(progress, 0.45));
  }, [progress]);

  // Single perpetual RAF loop started once on mount
  useEffect(() => {
    let rafId: ReturnType<typeof requestAnimationFrame>;

    const tick = () => {
      const elapsed = Date.now() - waveRef.current.mountTime;

      // ── Fill: smooth lerp towards current target (fast enough to look like
      //    a 1-2 second ease-out, adapts to target changes without restarting)
      const target = targetYRef.current;
      const LERP   = 0.055; // ~95 % of distance covered in ≈50 frames (0.83 s at 60 fps)
      const y1     = waveRef.current.y1 + (target       - waveRef.current.y1) * LERP;
      const y2     = waveRef.current.y2 + ((target + 6) - waveRef.current.y2) * LERP;
      waveRef.current.y1 = y1;
      waveRef.current.y2 = y2;

      // ── Slosh: continuous sine, delayed 0.8 s from mount so fill settles first
      const sloshMs = Math.max(elapsed - 800, 0);
      const x1 = 32 * Math.sin((sloshMs / 1200) * Math.PI); // 2.4 s full cycle, 32 px amplitude
      const x2 = x1 * 0.71; // wave-2 slightly narrower for depth

      setWave({ x1, y1, x2, y2 });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []); // starts once, runs until unmount

  const dropPath  = buildDropPath();
  // Absolute-coordinate wave paths computed from RAF state each render.
  // No <G transform> needed — Path `d` prop updates are reliable in rn-svg.
  const wavePath1 = buildWavePath(wave.y1, wave.x1, 18); // 18 px crest-to-trough
  const wavePath2 = buildWavePath(wave.y2, wave.x2, 13); // slightly shallower rear wave

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
                Path `d` prop is recomputed from RAF state each frame.
                rn-svg reliably updates leaf-element props (same path as
                AnimatedCircle strokeDashoffset); no <G transform> needed. */}
            <G clipPath="url(#drop-clip-tb)">
              {/* Solid floor — covers from the wave crest (wave.y1 = fillY,
                  the highest point of the surface) to the bottom.
                  The wave S-curve edges sit amp pixels BELOW the crest, so
                  without this floor a thin strip at the drop edges is above
                  the edge-level but below the crest and appears blank.
                  This rect eliminates that gap at all fill levels. */}
              <Path
                d={`M -24 ${wave.y1} H ${DROP_W + 24} V ${DROP_H * 2} H -24 Z`}
                fill={`${waterColor}30`}
              />
              {/* Wave 2 — behind, 71 % slosh for depth */}
              <Path d={wavePath2} fill={`${waterColor}40`} />
              {/* Wave 1 — front, full slosh amplitude */}
              <Path d={wavePath1} fill={`${waterColor}70`} />
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
        {/* ── Streak hero ───────────────────────────────────────────────── */}
        <View
          style={[
            styles.streakCard,
            {
              backgroundColor: currentStreak > 0
                ? "#10B98114"
                : colors.background + "80",
              borderColor: currentStreak > 0
                ? "#10B98130"
                : colors.border,
            },
          ]}
        >
          {/* Left: number + label */}
          <View style={styles.streakLeft}>
            <View style={styles.streakHeroRow}>
              <Ionicons
                name="flame"
                size={28}
                color={currentStreak > 0 ? "#10B981" : colors.mutedForeground}
                style={{ marginTop: 2 }}
              />
              <Text
                style={[
                  styles.streakHeroNum,
                  { color: currentStreak > 0 ? "#10B981" : colors.mutedForeground },
                ]}
              >
                {currentStreak}
              </Text>
            </View>
            <Text style={[styles.streakHeroLabel, { color: colors.mutedForeground }]}>
              {currentStreak === 1 ? "day streak" : "day streak"}
            </Text>
          </View>

          {/* Divider */}
          <View style={[styles.streakDivider, { backgroundColor: colors.border }]} />

          {/* Right: scan status + best */}
          <View style={styles.streakRight}>
            <View style={styles.streakBadgeRow}>
              <Ionicons
                name={todayScans > 0 ? "checkmark-circle" : "radio-button-off"}
                size={14}
                color={todayScans > 0 ? "#10B981" : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.streakBadgeText,
                  { color: todayScans > 0 ? "#10B981" : colors.mutedForeground },
                ]}
              >
                {todayScans > 0 ? "Scanned today" : "No scan yet"}
              </Text>
            </View>
            <Text style={[styles.streakBestText, { color: colors.mutedForeground }]}>
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

  // Streak hero card
  streakCard: {
    flexDirection: "row",
    alignItems:    "center",
    width:         "100%",
    borderRadius:  16,
    borderWidth:   1,
    paddingVertical:   14,
    paddingHorizontal: 16,
    marginTop: 4,
    gap: 14,
  },
  streakLeft: {
    flex: 1,
    gap: 2,
  },
  streakHeroRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
  },
  streakHeroNum: {
    fontSize:      44,
    fontFamily:    "Inter_700Bold",
    fontWeight:    "700",
    lineHeight:    50,
    letterSpacing: -1,
  },
  streakHeroLabel: {
    fontSize:   13,
    fontFamily: "Inter_500Medium",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: -2,
  },
  streakDivider: {
    width:        1,
    height:       48,
    borderRadius: 1,
  },
  streakRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  streakBadgeRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           5,
  },
  streakBadgeText: {
    fontSize:   13,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
  },
  streakBestText: {
    fontSize:   11,
    fontFamily: "Inter_400Regular",
  },

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
