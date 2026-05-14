import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHydration } from "@/context/HydrationContext";
import { useWorkout } from "@/context/WorkoutContext";
import { useColors } from "@/hooks/useColors";

function ElapsedTimer({ startDate }: { startDate: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () =>
      setElapsed(Math.floor((Date.now() - new Date(startDate).getTime()) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startDate]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const label = h > 0
    ? `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`
    : `${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  return <Text>{label}</Text>;
}

export default function WorkoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeWorkout, startWorkout, endWorkout } = useWorkout();
  const { latestScan } = useHydration();

  const [weightInput, setWeightInput] = useState("");
  const [lastWorkout, setLastWorkout] = useState<ReturnType<typeof endWorkout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const currentScore = latestScan?.score ?? null;

  const handleStart = () => {
    const lbs = parseFloat(weightInput);
    if (isNaN(lbs) || lbs < 50 || lbs > 500) {
      Alert.alert("Invalid Weight", "Enter your weight in pounds (50–500 lbs).");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    startWorkout(lbs, currentScore);
    setWeightInput("");
  };

  const handleEnd = () => {
    const lbs = parseFloat(weightInput);
    if (isNaN(lbs) || lbs < 50 || lbs > 500) {
      Alert.alert("Invalid Weight", "Enter your weight in pounds (50–500 lbs).");
      return;
    }
    if (!activeWorkout) return;
    if (lbs > activeWorkout.startWeightLbs) {
      Alert.alert(
        "Unexpected Weight",
        "Your end weight is higher than your start weight. This is unusual during a workout. Continue?",
        [
          { text: "Re-enter", style: "cancel" },
          {
            text: "Continue",
            onPress: () => {
              const finished = endWorkout(lbs, currentScore);
              setLastWorkout(finished);
              setWeightInput("");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            },
          },
        ]
      );
      return;
    }
    const finished = endWorkout(lbs, currentScore);
    setLastWorkout(finished);
    setWeightInput("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const scoreLabel = (s: number | null) => {
    if (s === null) return "—";
    return ["", "Critical", "Low", "Good", "Excellent"][s] ?? "—";
  };

  const scoreColor = (s: number | null) => {
    if (s === null) return colors.mutedForeground;
    return ["", "#EF4444", "#F97316", "#0EA5E9", "#10B981"][s] ?? colors.mutedForeground;
  };

  const sweatLossOzLabel = (oz: number | null) => {
    if (oz === null) return "—";
    if (oz < 1) return "< 1 oz";
    return `${oz.toFixed(1)} oz`;
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 16,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          <Text style={[styles.backLabel, { color: colors.foreground }]}>Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Workout Tracker</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Results card after workout ends */}
        {lastWorkout && (
          <View
            style={[
              styles.resultsCard,
              { backgroundColor: "#10B981" + "10", borderColor: "#10B981" + "40" },
            ]}
          >
            <View style={styles.resultsTitleRow}>
              <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              <Text style={[styles.resultsTitle, { color: "#10B981" }]}>Workout Complete</Text>
            </View>

            <View style={styles.resultsGrid}>
              <View style={[styles.resultItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.resultValue, { color: colors.foreground }]}>
                  {sweatLossOzLabel(lastWorkout.sweatLossOz)}
                </Text>
                <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>
                  Sweat Loss
                </Text>
              </View>

              <View style={[styles.resultItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.resultValue, { color: colors.foreground }]}>
                  {lastWorkout.sweatLossLbs !== null
                    ? `${lastWorkout.sweatLossLbs.toFixed(2)} lbs`
                    : "—"}
                </Text>
                <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>
                  Water Weight
                </Text>
              </View>

              <View style={[styles.resultItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text
                  style={[
                    styles.resultValue,
                    { color: scoreColor(lastWorkout.startHydrationScore) },
                  ]}
                >
                  {scoreLabel(lastWorkout.startHydrationScore)}
                </Text>
                <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>
                  Before
                </Text>
              </View>

              <View style={[styles.resultItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text
                  style={[
                    styles.resultValue,
                    { color: scoreColor(lastWorkout.endHydrationScore) },
                  ]}
                >
                  {scoreLabel(lastWorkout.endHydrationScore)}
                </Text>
                <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>
                  After
                </Text>
              </View>

              <View style={[styles.resultItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.resultValue, { color: colors.foreground }]}>
                  {lastWorkout.durationMinutes !== null
                    ? lastWorkout.durationMinutes >= 60
                      ? `${Math.floor(lastWorkout.durationMinutes / 60)}h ${lastWorkout.durationMinutes % 60}m`
                      : `${lastWorkout.durationMinutes}m`
                    : "—"}
                </Text>
                <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>
                  Duration
                </Text>
              </View>

              <View style={[styles.resultItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.resultValue, { color: colors.foreground }]}>
                  {lastWorkout.endWeightLbs?.toFixed(1) ?? "—"} lbs
                </Text>
                <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>
                  End Weight
                </Text>
              </View>
            </View>

            {(lastWorkout.sweatLossOz ?? 0) >= 16 && (
              <View
                style={[
                  styles.alertBanner,
                  { backgroundColor: "#F97316" + "15", borderColor: "#F97316" + "40" },
                ]}
              >
                <Ionicons name="water-outline" size={16} color="#F97316" />
                <Text style={[styles.alertText, { color: "#F97316" }]}>
                  You lost over 1 lb of water weight. Rehydrate with at least 16–24 oz of water.
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.doneBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => setLastWorkout(null)}
            >
              <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>
                Start New Workout
              </Text>
            </Pressable>
          </View>
        )}

        {/* Active workout panel */}
        {!lastWorkout && activeWorkout && (
          <View
            style={[
              styles.activeCard,
              { backgroundColor: colors.card, borderColor: colors.primary + "60" },
            ]}
          >
            <View style={styles.activeTitleRow}>
              <View style={styles.pulsingDot} />
              <Text style={[styles.activeTitle, { color: colors.foreground }]}>
                Workout In Progress
              </Text>
            </View>

            <View style={styles.activeMetaRow}>
              <View style={[styles.metaChip, { backgroundColor: colors.muted }]}>
                <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
                <Text style={[styles.metaChipText, { color: colors.mutedForeground }]}>
                  <ElapsedTimer startDate={activeWorkout.startDate} />
                </Text>
              </View>
              <View style={[styles.metaChip, { backgroundColor: colors.muted }]}>
                <Ionicons name="barbell-outline" size={14} color={colors.mutedForeground} />
                <Text style={[styles.metaChipText, { color: colors.mutedForeground }]}>
                  Start: {activeWorkout.startWeightLbs} lbs
                </Text>
              </View>
              {activeWorkout.startHydrationScore !== null && (
                <View
                  style={[
                    styles.metaChip,
                    {
                      backgroundColor:
                        scoreColor(activeWorkout.startHydrationScore) + "20",
                    },
                  ]}
                >
                  <Ionicons
                    name="water-outline"
                    size={14}
                    color={scoreColor(activeWorkout.startHydrationScore)}
                  />
                  <Text
                    style={[
                      styles.metaChipText,
                      { color: scoreColor(activeWorkout.startHydrationScore) },
                    ]}
                  >
                    {scoreLabel(activeWorkout.startHydrationScore)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Input form */}
        {!lastWorkout && (
          <View
            style={[
              styles.formCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.formTitle, { color: colors.foreground }]}>
              {activeWorkout ? "End Workout" : "Start Workout"}
            </Text>
            <Text style={[styles.formSub, { color: colors.mutedForeground }]}>
              {activeWorkout
                ? "Enter your weight now to calculate sweat loss."
                : "Enter your weight before starting your workout."}
            </Text>

            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                ref={inputRef}
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Weight in lbs (e.g. 185)"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                value={weightInput}
                onChangeText={setWeightInput}
                returnKeyType="done"
                onSubmitEditing={activeWorkout ? handleEnd : handleStart}
              />
              <Text style={[styles.inputUnit, { color: colors.mutedForeground }]}>lbs</Text>
            </View>

            {currentScore !== null && (
              <View
                style={[
                  styles.hydrationHint,
                  { backgroundColor: scoreColor(currentScore) + "15", borderColor: scoreColor(currentScore) + "40" },
                ]}
              >
                <Ionicons name="water-outline" size={14} color={scoreColor(currentScore)} />
                <Text style={[styles.hydrationHintText, { color: scoreColor(currentScore) }]}>
                  Current hydration: {scoreLabel(currentScore)} — will be recorded as your{" "}
                  {activeWorkout ? "post" : "pre"}-workout baseline.
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: activeWorkout ? "#10B981" : colors.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={activeWorkout ? handleEnd : handleStart}
            >
              <Ionicons
                name={activeWorkout ? "checkmark-circle-outline" : "play-outline"}
                size={20}
                color="#fff"
              />
              <Text style={styles.actionBtnText}>
                {activeWorkout ? "End Workout" : "Start Workout"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Info box */}
        {!lastWorkout && (
          <View
            style={[
              styles.infoBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>How it works</Text>
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Weigh yourself immediately before and after your workout. The difference in weight
              is primarily water lost through sweat. Every pound lost equals approximately 16 oz
              (500 mL) of fluid that should be replaced.
            </Text>
            <Text style={[styles.infoText, { color: colors.mutedForeground, marginTop: 8 }]}>
              For best accuracy, use the same scale and wear similar clothing both times.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, width: 70 },
  backLabel: { fontSize: 16, fontFamily: "Inter_400Regular" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  scroll: { padding: 20, gap: 16 },
  resultsCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  resultsTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultsTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
  },
  resultsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  resultItem: {
    flex: 1,
    minWidth: "44%",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 4,
  },
  resultValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
    textAlign: "center",
  },
  resultLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  alertText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  doneBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
  doneBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  activeCard: {
    borderRadius: 20,
    borderWidth: 2,
    padding: 18,
    gap: 14,
  },
  activeTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
  },
  activeTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  activeMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  metaChipText: { fontSize: 13, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  formTitle: { fontSize: 20, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  formSub: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    paddingVertical: 12,
  },
  inputUnit: { fontSize: 16, fontFamily: "Inter_400Regular" },
  hydrationHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  hydrationHintText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  actionBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    color: "#fff",
  },
  infoBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 6,
  },
  infoTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  infoText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
});
