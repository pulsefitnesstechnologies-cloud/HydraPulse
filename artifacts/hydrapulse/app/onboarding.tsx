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
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const STEPS = [
  {
    icon: "water-outline" as const,
    title: "Welcome to HydraPulse",
    subtitle:
      "Your smart hydration companion that reads your body's signals — no guesswork, no manual logging.",
    color: "#38BDF8",
  },
  {
    icon: "pulse-outline" as const,
    title: "How PPG Works",
    subtitle:
      "Photoplethysmography (PPG) measures blood volume changes through your fingertip. Your blood's hydration level affects how light reflects back to the camera.",
    color: "#10B981",
  },
  {
    icon: "phone-portrait-outline" as const,
    title: "Phone-Only Mode",
    subtitle:
      "Place your fingertip over the rear camera and flash. A 12-second scan captures your pulse waveform and estimates your hydration score.",
    color: "#0EA5E9",
  },
  {
    icon: "shield-checkmark-outline" as const,
    title: "Privacy First",
    subtitle:
      "All processing happens on your device. Your health data never leaves your phone without your permission.",
    color: "#8B5CF6",
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setHasOnboarded } = useHydration();
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const dotAnim = useRef(STEPS.map(() => new Animated.Value(0))).current;

  const updateDots = (newStep: number) => {
    STEPS.forEach((_, i) => {
      Animated.spring(dotAnim[i], {
        toValue: i === newStep ? 1 : 0,
        useNativeDriver: false,
        tension: 60,
        friction: 8,
      }).start();
    });
  };

  const goToStep = (newStep: number) => {
    Haptics.selectionAsync().catch(() => {});
    setStep(newStep);
    updateDots(newStep);
    scrollRef.current?.scrollTo({
      x: newStep * SCREEN_WIDTH,
      animated: true,
    });
  };

  const handleFinish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await setHasOnboarded(true);
    router.replace("/(tabs)");
  };

  const isLast = step === STEPS.length - 1;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + (Platform.OS === "web" ? 44 : 0),
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
        {STEPS.map((s, i) => (
          <View key={i} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={[styles.iconCircle, { backgroundColor: s.color + "20" }]}>
              <Ionicons name={s.icon} size={56} color={s.color} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>{s.title}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {s.subtitle}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {STEPS.map((_, i) => {
          const width = dotAnim[i].interpolate({
            inputRange: [0, 1],
            outputRange: [8, 24],
          });
          const opacity = dotAnim[i].interpolate({
            inputRange: [0, 1],
            outputRange: [0.35, 1],
          });
          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  width,
                  opacity,
                  backgroundColor: STEPS[step].color,
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.buttons}>
        {!isLast && (
          <Pressable onPress={handleFinish}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.nextBtn,
            {
              backgroundColor: STEPS[step].color,
              opacity: pressed ? 0.85 : 1,
              flex: isLast ? 1 : 0,
            },
          ]}
          onPress={isLast ? handleFinish : () => goToStep(step + 1)}
        >
          <Text style={styles.nextBtnText}>
            {isLast ? "Get Started" : "Next"}
          </Text>
          {!isLast && (
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
    textAlign: "center",
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
  },
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
    fontWeight: "500" as const,
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
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
});
