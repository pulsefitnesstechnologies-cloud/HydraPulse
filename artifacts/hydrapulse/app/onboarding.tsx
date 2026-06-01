import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHydration } from "@/context/HydrationContext";
import { useWaterIntake } from "@/context/WaterIntakeContext";
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { id: "hook",    color: "#38BDF8" },
  { id: "how",     color: "#10B981" },
  { id: "goal",    color: "#0EA5E9" },
  { id: "privacy", color: "#8B5CF6" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

// ─── Goal options ─────────────────────────────────────────────────────────────

const GOAL_OPTIONS = [48, 56, 64, 72, 80, 96];
const GOAL_LABELS: Record<number, string> = {
  48: "Light",
  56: "Moderate",
  64: "Standard",
  72: "Active",
  80: "Very Active",
  96: "Athlete",
};

// ─── Step 2 — How it works cards ──────────────────────────────────────────────

const HOW_STEPS: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; detail: string }[] = [
  { icon: "finger-print",           label: "Place Finger",  detail: "Cover rear camera + flash" },
  { icon: "hand-left-outline",      label: "Hold Still",    detail: "12-second countdown"       },
  { icon: "analytics-outline",      label: "Get Your Score", detail: "Hydration score + tips"   },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const colors    = useColors();
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const { setHasOnboarded } = useHydration();
  const { setDailyGoalOz }  = useWaterIntake();

  const [step, setStep]         = useState(0);
  const [goalOz, setGoalOz]     = useState(64);
  const scrollRef               = useRef<ScrollView>(null);
  const dotAnim                 = useRef(STEPS.map(() => new Animated.Value(0))).current;

  // initialise first dot
  React.useEffect(() => { dotAnim[0].setValue(1); }, []);

  const updateDots = (newStep: number) => {
    STEPS.forEach((_, i) => {
      Animated.spring(dotAnim[i], {
        toValue:     i === newStep ? 1 : 0,
        useNativeDriver: false,
        tension:     60,
        friction:    8,
      }).start();
    });
  };

  const goToStep = (newStep: number) => {
    Haptics.selectionAsync().catch(() => {});
    setStep(newStep);
    updateDots(newStep);
    scrollRef.current?.scrollTo({ x: newStep * SCREEN_WIDTH, animated: true });
  };

  const handleFinish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await setDailyGoalOz(goalOz);
    await setHasOnboarded(true);
    router.replace("/scan");
  };

  const isLast       = step === STEPS.length - 1;
  const currentColor = STEPS[step].color;
  const currentId: StepId = STEPS[step].id;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop:    insets.top  + (Platform.OS === "web" ? 44 : 0),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
        },
      ]}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {/* ── Step 1: Hook ─────────────────────────────────────────────── */}
        <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
          <View style={[styles.iconCircle, { backgroundColor: "#38BDF820" }]}>
            <Ionicons name="water" size={56} color="#38BDF8" />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            See how hydrated you really are — in 12 seconds.
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            HydraPulse reads your body's signals through your phone camera. No guesswork, no manual logging — just your actual hydration status.
          </Text>
        </View>

        {/* ── Step 2: How it works ─────────────────────────────────────── */}
        <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
          <Text style={[styles.title, { color: colors.foreground, marginBottom: 8 }]}>
            Three steps to your score
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, marginBottom: 24 }]}>
            Your first scan takes under 15 seconds.
          </Text>
          <View style={styles.howList}>
            {HOW_STEPS.map((h, i) => (
              <View
                key={i}
                style={[styles.howCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.howNumCircle, { backgroundColor: "#10B98120" }]}>
                  <Text style={[styles.howNum, { color: "#10B981" }]}>{i + 1}</Text>
                </View>
                <View style={[styles.howIconCircle, { backgroundColor: "#10B98115" }]}>
                  <Ionicons name={h.icon} size={26} color="#10B981" />
                </View>
                <View style={styles.howText}>
                  <Text style={[styles.howLabel, { color: colors.foreground }]}>{h.label}</Text>
                  <Text style={[styles.howDetail, { color: colors.mutedForeground }]}>{h.detail}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={[styles.scienceNote, { color: colors.mutedForeground }]}>
            Uses photoplethysmography (PPG) — the same principle as hospital pulse oximeters.
          </Text>
        </View>

        {/* ── Step 3: Daily Goal ───────────────────────────────────────── */}
        <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
          <View style={[styles.iconCircle, { backgroundColor: "#0EA5E920" }]}>
            <Ionicons name="trophy-outline" size={56} color="#0EA5E9" />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Set your daily water goal
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            You can change this anytime in Settings.
          </Text>
          <View style={styles.goalGrid}>
            {GOAL_OPTIONS.map((oz) => {
              const selected = oz === goalOz;
              return (
                <Pressable
                  key={oz}
                  style={[
                    styles.goalChip,
                    {
                      backgroundColor: selected ? "#0EA5E9" : colors.card,
                      borderColor:     selected ? "#0EA5E9" : colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setGoalOz(oz);
                  }}
                >
                  <Text style={[styles.goalChipOz,    { color: selected ? "#fff" : colors.foreground }]}>
                    {oz} oz
                  </Text>
                  <Text style={[styles.goalChipLabel, { color: selected ? "#ffffffbb" : colors.mutedForeground }]}>
                    {GOAL_LABELS[oz]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.goalNote, { color: colors.mutedForeground }]}>
            Selected: <Text style={{ color: "#0EA5E9", fontFamily: "Inter_600SemiBold" }}>{goalOz} fl oz / day</Text>
          </Text>
        </View>

        {/* ── Step 4: Privacy ──────────────────────────────────────────── */}
        <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
          <View style={[styles.iconCircle, { backgroundColor: "#8B5CF620" }]}>
            <Ionicons name="shield-checkmark-outline" size={56} color="#8B5CF6" />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Your data stays on your device
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            All processing happens locally. Your health data never leaves your phone without your explicit permission.
          </Text>
          <View style={styles.privacyList}>
            {[
              { icon: "camera-outline"       as const, text: "Camera access for PPG scan only" },
              { icon: "heart-outline"        as const, text: "HealthKit optional — never required" },
              { icon: "lock-closed-outline"  as const, text: "No account or sign-in required" },
            ].map((item, i) => (
              <View key={i} style={[styles.privacyRow, { borderColor: colors.border }]}>
                <Ionicons name={item.icon} size={18} color="#8B5CF6" />
                <Text style={[styles.privacyText, { color: colors.foreground }]}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ── Dots ─────────────────────────────────────────────────────────── */}
      <View style={styles.dots}>
        {STEPS.map((s, i) => {
          const width = dotAnim[i].interpolate({ inputRange: [0, 1], outputRange: [8, 24] });
          const opacity = dotAnim[i].interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
          return (
            <Animated.View
              key={i}
              style={[styles.dot, { width, opacity, backgroundColor: currentColor }]}
            />
          );
        })}
      </View>

      {/* ── Buttons ──────────────────────────────────────────────────────── */}
      <View style={styles.buttons}>
        {!isLast && (
          <Pressable onPress={handleFinish}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.nextBtn,
            { backgroundColor: currentColor, opacity: pressed ? 0.85 : 1, flex: isLast ? 1 : 0 },
          ]}
          onPress={isLast ? handleFinish : () => goToStep(step + 1)}
        >
          <Text style={styles.nextBtnText}>
            {isLast ? "Start My First Scan" : "Next"}
          </Text>
          {!isLast && <Ionicons name="arrow-forward" size={18} color="#fff" />}
          {isLast  && <Ionicons name="scan-outline"  size={18} color="#fff" />}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    gap: 16,
  },

  // Icon circle (steps 1, 3, 4)
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },

  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 33,
  },

  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },

  // ── Step 2: How cards
  howList: {
    width: "100%",
    gap: 10,
  },
  howCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  howNumCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  howNum: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
  },
  howIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  howText: {
    flex: 1,
    gap: 2,
  },
  howLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
  },
  howDetail: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  scienceNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },

  // ── Step 3: Goal picker
  goalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    width: "100%",
  },
  goalChip: {
    width: (SCREEN_WIDTH - 36 * 2 - 10 * 2) / 3,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: "center",
    gap: 3,
  },
  goalChipOz: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
  },
  goalChipLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  goalNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },

  // ── Step 4: Privacy list
  privacyList: {
    width: "100%",
    gap: 8,
    marginTop: 8,
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  privacyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },

  // ── Dots
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  // ── Buttons
  buttons: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 16,
  },
  skipText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    fontWeight: "500",
    paddingHorizontal: 8,
  },
  nextBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  nextBtnText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
