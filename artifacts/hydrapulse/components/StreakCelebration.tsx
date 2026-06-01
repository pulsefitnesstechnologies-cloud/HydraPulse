import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

import { useColors } from "@/hooks/useColors";

const MILESTONE: Record<number, { headline: string; sub: string }> = {
  3:  { headline: "3 days in a row!",     sub: "You're building a real habit." },
  7:  { headline: "One full week!",        sub: "Consistency is paying off." },
  14: { headline: "Two weeks strong!",     sub: "Your body is thanking you." },
  30: { headline: "30 day streak!",        sub: "Elite-level consistency." },
};

// 16 splash drops — mirror of web mockup coords
// [horizontal reach px, vertical reach px (neg = up), start delay ms]
const DROPS: readonly [number, number, number, number][] = [
  [-110, -55,  0,   5],
  [-130, -30,  135, 4],
  [-100, -70,  270, 3],
  [-145, -15,  405, 3],
  [ -90, -85,  90,  4],
  [-120, -45,  495, 3],
  [ 110, -55,  45,  5],
  [ 130, -30,  180, 4],
  [ 100, -70,  315, 3],
  [ 145, -15,  450, 3],
  [  90, -85,  135, 4],
  [ 120, -45,  540, 3],
  [ -20, -110, 45,  3],
  [  20, -110, 90,  3],
  [ -40, -105, 225, 2],
  [  40, -105, 270, 2],
];

// Flow lines inside the column
const FLOW = [
  { x: -12, w: 4, dur: 550, del: 0   },
  { x:   0, w: 6, dur: 500, del: 100 },
  { x:  12, w: 4, dur: 550, del: 200 },
  { x:  -6, w: 3, dur: 600, del: 300 },
  { x:   6, w: 3, dur: 600, del: 400 },
];

interface Props {
  streak: number;
  visible: boolean;
  onDismiss: () => void;
}

export function StreakCelebration({ streak, visible, onDismiss }: Props) {
  const colors = useColors();

  const cardScale   = useRef(new Animated.Value(0.8)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const surge       = useRef(new Animated.Value(0)).current;
  const ring1       = useRef(new Animated.Value(0)).current;
  const ring2       = useRef(new Animated.Value(0)).current;
  const ring3       = useRef(new Animated.Value(0)).current;

  // 16 drop animations
  const d0  = useRef(new Animated.Value(0)).current;
  const d1  = useRef(new Animated.Value(0)).current;
  const d2  = useRef(new Animated.Value(0)).current;
  const d3  = useRef(new Animated.Value(0)).current;
  const d4  = useRef(new Animated.Value(0)).current;
  const d5  = useRef(new Animated.Value(0)).current;
  const d6  = useRef(new Animated.Value(0)).current;
  const d7  = useRef(new Animated.Value(0)).current;
  const d8  = useRef(new Animated.Value(0)).current;
  const d9  = useRef(new Animated.Value(0)).current;
  const d10 = useRef(new Animated.Value(0)).current;
  const d11 = useRef(new Animated.Value(0)).current;
  const d12 = useRef(new Animated.Value(0)).current;
  const d13 = useRef(new Animated.Value(0)).current;
  const d14 = useRef(new Animated.Value(0)).current;
  const d15 = useRef(new Animated.Value(0)).current;
  const dropAnims = [d0,d1,d2,d3,d4,d5,d6,d7,d8,d9,d10,d11,d12,d13,d14,d15];

  // 5 flow line animations
  const f0 = useRef(new Animated.Value(0)).current;
  const f1 = useRef(new Animated.Value(0)).current;
  const f2 = useRef(new Animated.Value(0)).current;
  const f3 = useRef(new Animated.Value(0)).current;
  const f4 = useRef(new Animated.Value(0)).current;
  const flowAnims = [f0, f1, f2, f3, f4];

  useEffect(() => {
    if (!visible) return;

    cardScale.setValue(0.8);
    cardOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const loops: Animated.CompositeAnimation[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Column surge
    const surgeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(surge, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(surge, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    surgeLoop.start();
    loops.push(surgeLoop);

    // Ripple rings — staggered
    ([ring1, ring2, ring3] as Animated.Value[]).forEach((anim, idx) => {
      const t = setTimeout(() => {
        anim.setValue(0);
        const loop = Animated.loop(
          Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true })
        );
        loop.start();
        loops.push(loop);
      }, idx * 400);
      timers.push(t);
    });

    // Splash drops
    DROPS.forEach(([, , del], i) => {
      dropAnims[i].setValue(0);
      const t = setTimeout(() => {
        const dur = 850 + (i % 4) * 55;
        const loop = Animated.loop(
          Animated.timing(dropAnims[i], { toValue: 1, duration: dur, useNativeDriver: true })
        );
        loop.start();
        loops.push(loop);
      }, del);
      timers.push(t);
    });

    // Flow lines
    FLOW.forEach((fl, i) => {
      flowAnims[i].setValue(0);
      const t = setTimeout(() => {
        const loop = Animated.loop(
          Animated.timing(flowAnims[i], { toValue: 1, duration: fl.dur, useNativeDriver: true })
        );
        loop.start();
        loops.push(loop);
      }, fl.del);
      timers.push(t);
    });

    const dismissTimer = setTimeout(onDismiss, 5000);
    timers.push(dismissTimer);

    return () => {
      timers.forEach(clearTimeout);
      loops.forEach((l) => l.stop());
      [surge, ring1, ring2, ring3, ...dropAnims, ...flowAnims].forEach((a) => a.setValue(0));
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const msg  = MILESTONE[streak] ?? { headline: `${streak} day streak!`, sub: "Keep scanning every day." };
  const dots = Array.from({ length: Math.min(streak, 7) }, (_, i) => i);

  const ringStyle = (anim: Animated.Value) => ({
    transform: [
      { scaleX: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.7] }) },
      { scaleY: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) },
    ],
    opacity: anim.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.65, 0] }),
  });

  const dropStyle = (anim: Animated.Value, ax: number, ay: number) => ({
    transform: [
      { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, ax] }) },
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, ay] }) },
      { scale: anim.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1, 0.7, 0.1] }) },
    ],
    opacity: anim.interpolate({ inputRange: [0, 0.45, 0.85, 1], outputRange: [0.9, 0.8, 0.3, 0] }),
  });

  const flowStyle = (anim: Animated.Value) => ({
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [180, -60] }) },
    ],
    opacity: anim.interpolate({ inputRange: [0, 0.08, 0.75, 1], outputRange: [0, 0.8, 0.7, 0] }),
  });

  const colOpacity = surge.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: cardScale }], opacity: cardOpacity },
          ]}
        >
          {/* ── Geyser Scene ─────────────────────────────────────────────── */}
          <View style={styles.scene}>
            <View style={[StyleSheet.absoluteFill, styles.caveBg]} />

            {/* Rock crack veins */}
            {([
              { left: "18%", top: "5%",  rot: "12deg",  op: 0.15 },
              { left: "72%", top: "8%",  rot: "-18deg", op: 0.12 },
              { left: "35%", top: "2%",  rot: "5deg",   op: 0.10 },
              { left: "60%", top: "15%", rot: "-8deg",  op: 0.13 },
            ] as const).map((c, i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: c.left as `${number}%`,
                  top: c.top as `${number}%`,
                  width: 1,
                  height: "40%",
                  backgroundColor: "rgba(200,180,140,0.6)",
                  transform: [{ rotate: c.rot }],
                  opacity: c.op,
                }}
              />
            ))}

            {/* Ground layers */}
            <View style={styles.groundRidge} />
            <View style={styles.leftRock} />
            <View style={styles.rightRock} />
            <View style={styles.centerVent} />

            {/* Teal pool */}
            <View style={styles.poolOuter} />
            <View style={styles.poolInner} />

            {/* Ripple rings */}
            <View style={styles.ringsContainer}>
              <Animated.View style={[styles.ring, ringStyle(ring1)]} />
              <Animated.View style={[styles.ring, ringStyle(ring2)]} />
              <Animated.View style={[styles.ring, ringStyle(ring3)]} />
            </View>

            {/* Water column */}
            <Animated.View style={[styles.columnWrap, { opacity: colOpacity }]}>
              <Svg width={120} height={200} viewBox="0 0 120 200">
                <Defs>
                  <LinearGradient id="sc_colOuter" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0"   stopColor="#0898A8" />
                    <Stop offset="0.3" stopColor="#0CC0D4" />
                    <Stop offset="0.5" stopColor="#18D4E8" />
                    <Stop offset="0.7" stopColor="#0CC0D4" />
                    <Stop offset="1"   stopColor="#0898A8" />
                  </LinearGradient>
                  <LinearGradient id="sc_colInner" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0"    stopColor="rgba(120,240,255,0)" />
                    <Stop offset="0.35" stopColor="rgba(180,248,255,0.55)" />
                    <Stop offset="0.5"  stopColor="rgba(220,252,255,0.80)" />
                    <Stop offset="0.65" stopColor="rgba(180,248,255,0.55)" />
                    <Stop offset="1"    stopColor="rgba(120,240,255,0)" />
                  </LinearGradient>
                </Defs>
                <Path
                  d="M 44 198 C 40 160 28 100 22 50 C 20 30 30 8 60 2 C 90 8 100 30 98 50 C 92 100 80 160 76 198 Z"
                  fill="url(#sc_colOuter)"
                />
                <Path
                  d="M 50 195 C 48 158 40 98 38 50 C 37 32 45 14 60 10 C 75 14 83 32 82 50 C 80 98 72 158 70 195 Z"
                  fill="url(#sc_colInner)"
                />
                <Ellipse cx={60} cy={12} rx={38} ry={14} fill="rgba(255,255,255,0.85)" opacity={0.8} />
                <Ellipse cx={42} cy={18} rx={18} ry={8}  fill="rgba(255,255,255,0.55)" />
                <Ellipse cx={78} cy={18} rx={18} ry={8}  fill="rgba(255,255,255,0.55)" />
              </Svg>
            </Animated.View>

            {/* Flow lines clipped inside column shape */}
            <View style={styles.flowOuter}>
              <View style={styles.flowContainer}>
                {FLOW.map((fl, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.flowLine,
                      {
                        left: 19 + fl.x - fl.w / 2,
                        width: fl.w,
                      },
                      flowStyle(flowAnims[i]),
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* Splash drops — origin at mid-column */}
            <View style={styles.dropsOrigin}>
              {DROPS.map(([ax, ay, , r], i) => (
                <Animated.View
                  key={i}
                  style={[
                    {
                      position: "absolute",
                      top: -r,
                      left: -r,
                      width: r * 2,
                      height: r * 2,
                      borderRadius: r,
                      backgroundColor:
                        i % 4 === 0
                          ? "rgba(255,255,255,0.92)"
                          : "rgba(12,210,230,0.88)",
                    },
                    dropStyle(dropAnims[i], ax, ay),
                  ]}
                />
              ))}
            </View>

            {/* Fade to card bg at bottom */}
            <View style={styles.sceneFade} />
          </View>

          {/* Day badge */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>DAY {streak}</Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.streakNum}>{streak}</Text>
            <Text style={[styles.headline, { color: colors.foreground }]}>{msg.headline}</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>{msg.sub}</Text>

            <View style={styles.dotsRow}>
              {dots.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { opacity: 0.3 + (i / Math.max(Math.min(streak, 7) - 1, 1)) * 0.7 },
                  ]}
                />
              ))}
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
    borderColor: "rgba(12,192,212,0.35)",
    overflow: "hidden",
  },
  scene: {
    width: "100%",
    height: 250,
    overflow: "hidden",
  },
  caveBg: {
    backgroundColor: "#1E1C1A",
  },
  groundRidge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: "#1C1510",
    opacity: 0.95,
  },
  leftRock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "38%",
    height: 60,
    backgroundColor: "#3D2E18",
    borderTopRightRadius: 60,
  },
  rightRock: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: "38%",
    height: 60,
    backgroundColor: "#3D2E18",
    borderTopLeftRadius: 60,
  },
  centerVent: {
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
    width: 130,
    height: 40,
    backgroundColor: "#231A0C",
    borderTopLeftRadius: 65,
    borderTopRightRadius: 65,
  },
  poolOuter: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    width: 110,
    height: 30,
    borderRadius: 55,
    backgroundColor: "#0891B2",
    opacity: 0.95,
  },
  poolInner: {
    position: "absolute",
    bottom: 28,
    alignSelf: "center",
    width: 94,
    height: 22,
    borderRadius: 47,
    backgroundColor: "#22D3EE",
    opacity: 0.65,
  },
  ringsContainer: {
    position: "absolute",
    bottom: 26,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    height: 30,
  },
  ring: {
    position: "absolute",
    width: 110,
    height: 30,
    borderRadius: 55,
    borderWidth: 1.5,
    borderColor: "rgba(18,200,220,0.7)",
    backgroundColor: "transparent",
  },
  columnWrap: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  flowOuter: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  flowContainer: {
    width: 38,
    height: 180,
    overflow: "hidden",
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
  },
  flowLine: {
    position: "absolute",
    top: 0,
    height: 50,
    borderRadius: 9,
    backgroundColor: "#DCF8FF",
  },
  dropsOrigin: {
    position: "absolute",
    bottom: 100,
    left: "50%",
    width: 0,
    height: 0,
  },
  sceneFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: "#0D1520",
    opacity: 0.55,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: -16,
    marginRight: 14,
  },
  badge: {
    backgroundColor: "rgba(12,192,212,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
  },
  badgeText: {
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
    paddingTop: 4,
    gap: 6,
  },
  streakNum: {
    fontSize: 62,
    fontFamily: "Inter_700Bold",
    fontWeight: "900",
    color: "#0CC8DC",
    letterSpacing: -2,
    lineHeight: 66,
  },
  headline: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    textAlign: "center",
  },
  sub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0CC8DC",
  },
  dismiss: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    opacity: 0.6,
  },
});
