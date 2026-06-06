import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const { width: W } = Dimensions.get("window");

// ─── Slide definitions ────────────────────────────────────────────────────────

interface Chip { label: string }
interface Slide {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  title: string;
  body: string;
  chips?: Chip[];
}

const SLIDES: Slide[] = [
  {
    icon: "compass-outline",
    color: "#38BDF8",
    title: "A quick tour",
    body: "HydraPulse has a few key areas. This takes about 60 seconds — or tap Skip anytime.",
  },
  {
    icon: "home-outline",
    color: "#10B981",
    title: "Your Dashboard",
    body: "The Home tab shows your current hydration score, today's water intake, and a 7-day trend. Tap Log Water to record a drink, or Scan Now to run a new check.",
    chips: [
      { label: "Hydration Score" },
      { label: "Water Log" },
      { label: "7-Day Trend" },
      { label: "Quick Scan" },
    ],
  },
  {
    icon: "scan-outline",
    color: "#0EA5E9",
    title: "Running a Scan",
    body: "Cover the rear camera and flash with your fingertip. HydraPulse reads your pulse wave over 12 seconds and converts it into a hydration score. Apple Watch users can scan hands-free.",
    chips: [
      { label: "12-second scan" },
      { label: "Camera mode" },
      { label: "Watch mode" },
    ],
  },
  {
    icon: "bar-chart-outline",
    color: "#8B5CF6",
    title: "Your Results",
    body: "Scores run from 1 (Critical) to 4 (Well Hydrated). Each result includes heart rate, HRV, a confidence level, and tips to help you course-correct.",
    chips: [
      { label: "1 — Critical" },
      { label: "2 — Low" },
      { label: "3 — Good" },
      { label: "4 — Hydrated" },
    ],
  },
  {
    icon: "time-outline",
    color: "#F59E0B",
    title: "History",
    body: "Your full scan log is here. Tap any scan for details, swipe left to delete. The Water tab tracks your logged intake with daily totals and trends.",
    chips: [
      { label: "Scan log" },
      { label: "Water intake tab" },
      { label: "Swipe to delete" },
      { label: "Tap for details" },
    ],
  },
  {
    icon: "notifications-outline",
    color: "#06B6D4",
    title: "Smart Reminders",
    body: "Scan Alarms trigger automatic Watch scans at set times. Gap & Goal Nudges fire when you haven't logged anything in 3+ hours or are falling behind on your daily goal. Both are in Settings.",
    chips: [
      { label: "Scan Alarms" },
      { label: "Gap Nudges" },
      { label: "Goal Nudges" },
      { label: "Auto-Schedule" },
    ],
  },
  {
    icon: "checkmark-circle-outline",
    color: "#10B981",
    title: "You're all set",
    body: "Everything you need is a tap away. You can replay this tour anytime from Settings — just scroll to the About section.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface FeatureTourProps {
  visible: boolean;
  onDone: () => void;
}

export function FeatureTour({ visible, onDone }: FeatureTourProps) {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const dotAnim   = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

  const updateDots = (newStep: number) => {
    SLIDES.forEach((_, i) => {
      Animated.spring(dotAnim[i], {
        toValue: i === newStep ? 1 : 0,
        useNativeDriver: false,
        tension: 60,
        friction: 8,
      }).start();
    });
  };

  const goTo = (newStep: number) => {
    Haptics.selectionAsync().catch(() => {});
    setStep(newStep);
    updateDots(newStep);
    scrollRef.current?.scrollTo({ x: newStep * W, animated: true });
  };

  const handleDone = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onDone();
    // Reset for if user replays later
    setTimeout(() => { goTo(0); }, 400);
  };

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + (Platform.OS === "web" ? 44 : 16),
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
          },
        ]}
      >
        {/* Skip button */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={handleDone}
            style={({ pressed }) => [styles.skipBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={12}
          >
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
          </Pressable>
        </View>

        {/* Slides */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {SLIDES.map((s, i) => (
            <View key={i} style={[styles.slide, { width: W }]}>
              {/* Icon */}
              <View style={[styles.iconCircle, { backgroundColor: s.color + "20" }]}>
                <Ionicons name={s.icon} size={54} color={s.color} />
              </View>

              {/* Step pill */}
              <View style={[styles.stepPill, { backgroundColor: s.color + "18", borderColor: s.color + "35" }]}>
                <Text style={[styles.stepPillText, { color: s.color }]}>
                  {i + 1} of {SLIDES.length}
                </Text>
              </View>

              {/* Title */}
              <Text style={[styles.title, { color: colors.foreground }]}>{s.title}</Text>

              {/* Body */}
              <Text style={[styles.body, { color: colors.mutedForeground }]}>{s.body}</Text>

              {/* Feature chips */}
              {s.chips && (
                <View style={styles.chips}>
                  {s.chips.map((c, ci) => (
                    <View
                      key={ci}
                      style={[styles.chip, { backgroundColor: s.color + "12", borderColor: s.color + "28" }]}
                    >
                      <Text style={[styles.chipText, { color: s.color }]}>{c.label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Dot indicators */}
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: dotAnim[i].interpolate({
                    inputRange:  [0, 1],
                    outputRange: [colors.border, slide.color],
                  }),
                  width: dotAnim[i].interpolate({
                    inputRange:  [0, 1],
                    outputRange: [6, 20],
                  }),
                },
              ]}
            />
          ))}
        </View>

        {/* Navigation */}
        <View style={styles.nav}>
          {step > 0 ? (
            <Pressable
              onPress={() => goTo(step - 1)}
              style={({ pressed }) => [
                styles.backBtn,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.backText, { color: colors.mutedForeground }]}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}

          <Pressable
            onPress={isLast ? handleDone : () => goTo(step + 1)}
            style={({ pressed }) => [
              styles.nextBtn,
              { backgroundColor: slide.color, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Text style={styles.nextText}>{isLast ? "Get started" : "Next"}</Text>
            {!isLast && <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 4 }} />}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  skipBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  skipText: { fontSize: 15, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stepPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  stepPillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
    textAlign: "center",
    lineHeight: 32,
  },
  body: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 16,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 88,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
  },
  backText: { fontSize: 15, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  nextBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  nextText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    color: "#fff",
  },
});
