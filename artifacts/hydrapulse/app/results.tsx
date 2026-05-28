import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { ScoreGauge } from "@/components/ScoreGauge";
import { HydrationScore, getScoreColor, getScoreLabel, useHydration } from "@/context/HydrationContext";
import { useColors } from "@/hooks/useColors";

const SCORE_TIPS: Record<HydrationScore, { title: string; tips: string[] }> = {
  1: {
    title: "Critical — Drink water now",
    tips: [
      "Drink at least 500ml of water immediately",
      "Avoid caffeine and alcohol for the next few hours",
      "Rest and reduce physical activity",
      "Consider electrolyte drinks if you've been sweating",
      "Seek medical attention if symptoms persist",
    ],
  },
  2: {
    title: "Low — You're mildly dehydrated",
    tips: [
      "Drink 250-500ml of water in the next 30 minutes",
      "Aim for 2 glasses of water before your next meal",
      "Limit diuretics like coffee and tea temporarily",
      "Monitor for headache or fatigue — common dehydration signs",
    ],
  },
  3: {
    title: "Good — Keep it up!",
    tips: [
      "Continue drinking water regularly throughout the day",
      "Aim for 8 glasses (2L) total today",
      "Light exercise is fine — rehydrate after",
      "Eat water-rich foods like cucumber and watermelon",
    ],
  },
  4: {
    title: "Excellent — Peak hydration!",
    tips: [
      "Outstanding hydration level — keep your current routine",
      "You can sustain moderate-intensity exercise",
      "Your skin and cognitive function are at their best",
      "Scan again in 4-6 hours to maintain this level",
    ],
  },
};

const SCORE_EXPLANATIONS: Record<HydrationScore, string> = {
  1: "Your PPG signal indicates significantly reduced blood volume and poor vasodilation — hallmarks of severe dehydration. Your body needs water urgently.",
  2: "Your pulse waveform shows mild dehydration markers. Blood viscosity appears elevated and vasodilation is slightly compromised.",
  3: "Your PPG signal shows healthy blood volume and good vasodilation. Minor fluctuations are normal throughout the day.",
  4: "Excellent PPG signal quality. Your blood volume, pulse pressure, and vasodilation are all in the optimal range.",
};

export default function ResultsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { score, label } = useLocalSearchParams<{ score: string; label: string }>();
  const { latestScan } = useHydration();

  const scoreNum = (Number(score) || latestScan?.score || 3) as HydrationScore;
  const scoreColor = getScoreColor(scoreNum);
  const tips = SCORE_TIPS[scoreNum];
  const explanation = SCORE_EXPLANATIONS[scoreNum];

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }),
    ]).start();
    Haptics.notificationAsync(
      scoreNum >= 3
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning
    ).catch(() => {});
  }, []);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable style={styles.doneBtn} onPress={() => router.replace("/(tabs)")}>
          <Text style={[styles.doneBtnText, { color: colors.primary }]}>Done</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Your Results</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 + (Platform.OS === "web" ? 34 : 0) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.scoreSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <ScoreGauge score={scoreNum} size={220} />

          <View style={[styles.scoreBadge, { backgroundColor: scoreColor + "20", borderColor: scoreColor + "40" }]}>
            <Text style={[styles.scoreBadgeText, { color: scoreColor }]}>
              {getScoreLabel(scoreNum)}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            What This Means
          </Text>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            {explanation}
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            {tips.title}
          </Text>
          <View style={styles.tipsList}>
            {tips.tips.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={[styles.tipBullet, { backgroundColor: scoreColor }]} />
                <Text style={[styles.tipText, { color: colors.mutedForeground }]}>
                  {tip}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {latestScan && (
          <View style={[styles.metricsRow]}>
            {(latestScan.liveHeartRate ?? latestScan.heartRate) && (
              <View style={[styles.metricPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="heart-outline" size={16} color={colors.primary} />
                <Text style={[styles.metricVal, { color: colors.foreground }]}>
                  {latestScan.liveHeartRate ?? latestScan.heartRate}
                </Text>
                <Text style={[styles.metricUnit, { color: colors.mutedForeground }]}>
                  {latestScan.liveHeartRate != null && latestScan.method === "watch" ? "Current BPM" : "BPM"}
                </Text>
              </View>
            )}
            {latestScan.hrv && (
              <View style={[styles.metricPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="pulse-outline" size={16} color={colors.accent} />
                <Text style={[styles.metricVal, { color: colors.foreground }]}>
                  {latestScan.hrv}
                </Text>
                <Text style={[styles.metricUnit, { color: colors.mutedForeground }]}>HRV</Text>
              </View>
            )}
            <View style={[styles.metricPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.accent} />
              <Text style={[styles.metricVal, { color: colors.foreground }]}>
                {latestScan.confidence}%
              </Text>
              <Text style={[styles.metricUnit, { color: colors.mutedForeground }]}>Confidence</Text>
            </View>
          </View>
        )}

        <View style={styles.disclaimerWrapper}>
          <DisclaimerBanner />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.rescanBtn,
            { backgroundColor: scoreColor, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => router.push("/scan")}
        >
          <Ionicons name="scan-outline" size={20} color="#fff" />
          <Text style={styles.rescanBtnText}>Scan Again</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  doneBtn: { paddingHorizontal: 4, paddingVertical: 8 },
  doneBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  scoreSection: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 12,
  },
  scoreBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  scoreBadgeText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  cardBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  tipsList: { gap: 12 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricPill: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  metricVal: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
  },
  metricUnit: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  disclaimerWrapper: {},
  rescanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    marginTop: 4,
  },
  rescanBtnText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
});
