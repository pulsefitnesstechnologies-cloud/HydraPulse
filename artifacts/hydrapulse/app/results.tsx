export { ErrorBoundary } from "@/components/ErrorBoundary";

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";

import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { ScoreGauge } from "@/components/ScoreGauge";
import { ShareCard } from "@/components/ShareCard";
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
  const { score } = useLocalSearchParams<{ score: string; label: string }>();
  const { latestScan } = useHydration();

  const scoreNum = (Number(score) || latestScan?.score || 3) as HydrationScore;
  const scoreColor = getScoreColor(scoreNum);
  const tips = SCORE_TIPS[scoreNum];
  const explanation = SCORE_EXPLANATIONS[scoreNum];

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Share state
  const viewShotRef = useRef<ViewShot>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [hideMetrics, setHideMetrics] = useState(false);
  const [capturing, setCapturing] = useState(false);

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

  async function captureCard(): Promise<string | null> {
    if (!viewShotRef.current) return null;
    setCapturing(true);
    try {
      const uri = await (viewShotRef.current as any).capture();
      return uri as string;
    } catch {
      return null;
    } finally {
      setCapturing(false);
    }
  }

  async function handleSaveToPhotos() {
    if (!latestScan) return;
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Allow HydraPulse to save to your photo library in Settings.",
      );
      return;
    }
    const uri = await captureCard();
    if (!uri) {
      Alert.alert("Error", "Could not capture the card. Please try again.");
      return;
    }
    try {
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setShareVisible(false);
      Alert.alert("Saved", "Your result card has been saved to your photo library.");
    } catch {
      Alert.alert("Error", "Could not save the image. Please try again.");
    }
  }

  async function handleShare() {
    if (!latestScan) return;
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert("Not Available", "Sharing is not supported on this device.");
      return;
    }
    const uri = await captureCard();
    if (!uri) {
      Alert.alert("Error", "Could not capture the card. Please try again.");
      return;
    }
    try {
      setShareVisible(false);
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your hydration result" });
    } catch {
      // User cancelled sharing — no error needed
    }
  }

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
        <Pressable
          style={styles.doneBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            router.replace("/(tabs)");
          }}
        >
          <Text style={[styles.doneBtnText, { color: colors.primary }]}>Done</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Your Results</Text>
        {latestScan ? (
          <Pressable
            style={styles.shareBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setShareVisible(true);
            }}
          >
            <Ionicons name="share-outline" size={22} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
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

          {latestScan && (
            <View style={styles.metricsRow}>
              {(latestScan.liveHeartRate ?? latestScan.heartRate) && (
                <View style={[styles.metricPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="heart-outline" size={16} color={colors.primary} />
                  <Text style={[styles.metricVal, { color: colors.foreground }]}>
                    {latestScan.method === "watch"
                      ? (latestScan.heartRate ?? latestScan.liveHeartRate)
                      : (latestScan.liveHeartRate ?? latestScan.heartRate)}
                  </Text>
                  <Text style={[styles.metricUnit, { color: colors.mutedForeground }]}>
                    {latestScan.method === "watch" ? "RHR" : "BPM"}
                  </Text>
                </View>
              )}
              {latestScan.hrv && (
                <View style={[styles.metricPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="pulse-outline" size={16} color={colors.accent} />
                  <Text style={[styles.metricVal, { color: colors.foreground }]}>{latestScan.hrv}</Text>
                  <Text style={[styles.metricUnit, { color: colors.mutedForeground }]}>HRV</Text>
                </View>
              )}
              <View style={[styles.metricPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.accent} />
                <Text style={[styles.metricVal, { color: colors.foreground }]}>{latestScan.confidence}%</Text>
                <Text style={[styles.metricUnit, { color: colors.mutedForeground }]}>Confidence</Text>
              </View>
            </View>
          )}

          {latestScan && (
            <View style={[styles.methodPill, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Ionicons
                name={latestScan.method === "watch" ? "watch-outline" : "flashlight-outline"}
                size={12}
                color={colors.mutedForeground}
              />
              <Text style={[styles.methodText, { color: colors.mutedForeground }]}>
                {latestScan.method === "watch" ? "Watch — Resting Baseline" : "Camera — Live Reading"}
              </Text>
            </View>
          )}
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

        {latestScan?.method === "watch" && (
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: colors.primary + "08",
                borderColor: colors.primary + "25",
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.watchNoteHeader}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                Watch vs. Camera Scores
              </Text>
            </View>
            <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
              Watch scores reflect your resting baseline — heart rate and HRV recorded during low-activity periods earlier today. Camera scores capture your live state right now. A gap between the two is normal and often means you have hydrated recently.
            </Text>
          </Animated.View>
        )}

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

        <View style={styles.disclaimerWrapper}>
          <DisclaimerBanner />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.rescanBtn,
            { backgroundColor: scoreColor, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push("/scan");
          }}
        >
          <Ionicons name="scan-outline" size={20} color="#fff" />
          <Text style={styles.rescanBtnText}>Scan Again</Text>
        </Pressable>
      </ScrollView>

      {/* Share Modal */}
      {latestScan && (
        <Modal
          visible={shareVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setShareVisible(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShareVisible(false)} />
          <View style={[styles.shareSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
            {/* Handle */}
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Share Results</Text>

            {/* Card preview */}
            <View style={styles.cardPreviewWrapper}>
              <ViewShot
                ref={viewShotRef}
                options={{ format: "png", quality: 1, result: "tmpfile" }}
              >
                <ShareCard scan={latestScan} hideMetrics={hideMetrics} />
              </ViewShot>
            </View>

            {/* Privacy toggle */}
            <View style={[styles.privacyRow, { borderColor: colors.border }]}>
              <View style={styles.privacyLabel}>
                <Ionicons name="eye-off-outline" size={18} color={colors.mutedForeground} />
                <Text style={[styles.privacyText, { color: colors.foreground }]}>
                  Hide health numbers
                </Text>
              </View>
              <Switch
                value={hideMetrics}
                onValueChange={setHideMetrics}
                trackColor={{ false: colors.border, true: colors.primary + "80" }}
                thumbColor={hideMetrics ? colors.primary : colors.mutedForeground}
              />
            </View>

            {/* Actions */}
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: colors.muted, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
                onPress={handleSaveToPhotos}
                disabled={capturing}
              >
                {capturing ? (
                  <ActivityIndicator size="small" color={colors.foreground} />
                ) : (
                  <Ionicons name="download-outline" size={20} color={colors.foreground} />
                )}
                <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
                  Save to Photos
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: scoreColor, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
                onPress={handleShare}
                disabled={capturing}
              >
                {capturing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="share-outline" size={20} color="#fff" />
                )}
                <Text style={[styles.actionBtnText, { color: "#fff" }]}>Share</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
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
  doneBtn: { paddingHorizontal: 4, paddingVertical: 8, minWidth: 60 },
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
  shareBtn: {
    minWidth: 60,
    alignItems: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  scoreSection: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
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
  methodPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  methodText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
  },
  watchNoteHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
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
    borderRadius: 16,
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
  // Share modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  shareSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
    textAlign: "center",
  },
  cardPreviewWrapper: {
    alignItems: "center",
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  privacyLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  privacyText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  actionBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
});
