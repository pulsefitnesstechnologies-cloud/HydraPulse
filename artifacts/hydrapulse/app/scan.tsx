import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { WaveformPreview } from "@/components/WaveformPreview";
import {
  FREE_SCANS_PER_WEEK,
  HydrationScore,
  ScanMethod,
  ScanRecord,
  getScoreLabel,
  useHydration,
} from "@/context/HydrationContext";
import { useColors } from "@/hooks/useColors";

const SCAN_DURATION = 12;

function simulatePPGScan(): {
  score: HydrationScore;
  heartRate: number;
  hrv: number;
  confidence: number;
} {
  const roll = Math.random();
  let score: HydrationScore;
  if (roll < 0.12) score = 1;
  else if (roll < 0.32) score = 2;
  else if (roll < 0.70) score = 3;
  else score = 4;

  return {
    score,
    heartRate: Math.round(62 + Math.random() * 28),
    hrv: Math.round(28 + Math.random() * 44),
    confidence: Math.round(78 + Math.random() * 18),
  };
}

type ScanState = "idle" | "scanning" | "done" | "paused";

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    scanMode,
    setScanMode,
    scansThisWeek,
    isPremium,
    addScanResult,
  } = useHydration();

  const [state, setState] = useState<ScanState>("idle");
  const [timeLeft, setTimeLeft] = useState(SCAN_DURATION);
  const [result, setResult] = useState<ReturnType<typeof simulatePPGScan> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fingerAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const canScan = isPremium || scansThisWeek < FREE_SCANS_PER_WEEK;

  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [pulseAnim]);

  const startScan = useCallback(() => {
    if (!canScan) return;
    setState("scanning");
    setTimeLeft(SCAN_DURATION);
    setResult(null);
    startPulse();

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: SCAN_DURATION * 1000,
      useNativeDriver: false,
    }).start();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          finishScan();
          return 0;
        }
        if (prev % 3 === 0) {
          Haptics.selectionAsync().catch(() => {});
        }
        return prev - 1;
      });
    }, 1000);
  }, [canScan, startPulse, progressAnim]);

  const finishScan = useCallback(() => {
    stopPulse();
    setState("done");
    const scanResult = simulatePPGScan();
    setResult(scanResult);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [stopPulse]);

  const cancelScan = useCallback(() => {
    clearInterval(timerRef.current!);
    stopPulse();
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    setState("idle");
    setTimeLeft(SCAN_DURATION);
  }, [stopPulse, progressAnim]);

  const saveResult = useCallback(async () => {
    if (!result) return;
    const record: ScanRecord = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      score: result.score,
      label: getScoreLabel(result.score),
      method: scanMode,
      confidence: result.confidence,
      heartRate: result.heartRate,
      hrv: result.hrv,
    };
    await addScanResult(record);
    router.replace({
      pathname: "/results",
      params: { recordId: record.id, score: record.score, label: record.label },
    });
  }, [result, scanMode, addScanResult, router]);

  useEffect(() => {
    return () => { clearInterval(timerRef.current!); };
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const scoreColors: Record<HydrationScore, string> = {
    1: "#EF4444",
    2: "#F97316",
    3: "#0EA5E9",
    4: "#10B981",
  };
  const resultColor = result ? scoreColors[result.score] : colors.primary;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => { cancelScan(); router.back(); }}
          style={styles.backBtn}
        >
          <Ionicons name="close" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Hydration Scan
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.modeToggle}>
        {(["simulation", "phone"] as ScanMethod[]).map((m) => (
          <Pressable
            key={m}
            style={[
              styles.modeBtn,
              {
                backgroundColor:
                  scanMode === m ? colors.primary : colors.secondary,
              },
            ]}
            onPress={() => setScanMode(m)}
            disabled={state === "scanning"}
          >
            <Ionicons
              name={m === "phone" ? "camera-outline" : "flask-outline"}
              size={16}
              color={scanMode === m ? colors.primaryForeground : colors.mutedForeground}
            />
            <Text
              style={[
                styles.modeBtnText,
                {
                  color:
                    scanMode === m ? colors.primaryForeground : colors.mutedForeground,
                },
              ]}
            >
              {m === "phone" ? "Camera" : "Simulation"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.scanArea}>
        {state === "idle" && (
          <View style={styles.idleContent}>
            <Animated.View
              style={[
                styles.fingerTarget,
                { borderColor: colors.primary, transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Ionicons name="finger-print-outline" size={64} color={colors.primary} />
            </Animated.View>
            <Text style={[styles.instruction, { color: colors.foreground }]}>
              {scanMode === "phone"
                ? "Cover the rear camera with your fingertip"
                : "Ready to run a simulated PPG scan"}
            </Text>
            <Text style={[styles.subInstruction, { color: colors.mutedForeground }]}>
              {scanMode === "phone"
                ? "Press firmly and hold still. Flash will activate automatically."
                : "Simulates PPG signal processing without hardware."}
            </Text>
          </View>
        )}

        {state === "scanning" && (
          <View style={styles.scanningContent}>
            <View style={styles.timerCircle}>
              <View
                style={[styles.timerInner, { borderColor: colors.primary + "30" }]}
              >
                <Text style={[styles.timerNumber, { color: colors.primary }]}>
                  {timeLeft}
                </Text>
                <Text style={[styles.timerLabel, { color: colors.mutedForeground }]}>
                  seconds
                </Text>
              </View>
            </View>

            <View style={styles.waveformContainer}>
              <WaveformPreview isActive={true} width={280} height={70} color={colors.primary} />
            </View>

            <Text style={[styles.scanningHint, { color: colors.mutedForeground }]}>
              {scanMode === "phone"
                ? "Hold still — reading your pulse waveform..."
                : "Processing PPG signal simulation..."}
            </Text>

            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.primary, width: progressWidth },
                ]}
              />
            </View>
          </View>
        )}

        {state === "done" && result && (
          <View style={styles.doneContent}>
            <View style={[styles.resultCircle, { borderColor: resultColor + "40", backgroundColor: resultColor + "15" }]}>
              <Ionicons name="checkmark-circle" size={60} color={resultColor} />
              <Text style={[styles.resultScore, { color: resultColor }]}>
                {result.score}/4
              </Text>
              <Text style={[styles.resultLabel, { color: resultColor }]}>
                {getScoreLabel(result.score)}
              </Text>
            </View>

            <View style={styles.metrics}>
              <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.metricValue, { color: colors.foreground }]}>
                  {result.heartRate}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>BPM</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.metricValue, { color: colors.foreground }]}>
                  {result.hrv}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>HRV</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.metricValue, { color: colors.foreground }]}>
                  {result.confidence}%
                </Text>
                <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Confidence</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={styles.bottomArea}>
        <DisclaimerBanner />

        {!canScan && state === "idle" && (
          <View style={[styles.limitBanner, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "40" }]}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.destructive} />
            <Text style={[styles.limitText, { color: colors.destructive }]}>
              {`Weekly scan limit reached (${FREE_SCANS_PER_WEEK} free). Upgrade to Premium.`}
            </Text>
          </View>
        )}

        {state === "idle" && (
          <Pressable
            style={({ pressed }) => [
              styles.startBtn,
              {
                backgroundColor: canScan ? colors.primary : colors.muted,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={startScan}
            disabled={!canScan}
          >
            <Ionicons
              name="scan-outline"
              size={22}
              color={canScan ? colors.primaryForeground : colors.mutedForeground}
            />
            <Text
              style={[
                styles.startBtnText,
                {
                  color: canScan
                    ? colors.primaryForeground
                    : colors.mutedForeground,
                },
              ]}
            >
              Start Scan
            </Text>
          </Pressable>
        )}

        {state === "scanning" && (
          <Pressable
            style={({ pressed }) => [
              styles.cancelBtn,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={cancelScan}
          >
            <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>
              Cancel
            </Text>
          </Pressable>
        )}

        {state === "done" && (
          <View style={styles.doneButtons}>
            <Pressable
              style={({ pressed }) => [
                styles.retryBtn,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => {
                setState("idle");
                setTimeLeft(SCAN_DURATION);
                setResult(null);
                progressAnim.setValue(0);
              }}
            >
              <Ionicons name="refresh-outline" size={20} color={colors.foreground} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: resultColor, opacity: pressed ? 0.85 : 1, flex: 1 },
              ]}
              onPress={saveResult}
            >
              <Text style={styles.saveBtnText}>Save & View Results</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  modeToggle: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  modeBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
  },
  scanArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  idleContent: {
    alignItems: "center",
    gap: 20,
  },
  fingerTarget: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
  },
  instruction: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    textAlign: "center",
    lineHeight: 26,
  },
  subInstruction: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  scanningContent: {
    alignItems: "center",
    gap: 20,
    width: "100%",
  },
  timerCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  timerInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  timerNumber: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
  },
  timerLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: -4,
  },
  waveformContainer: {
    width: "100%",
    alignItems: "center",
  },
  scanningHint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  progressBar: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  doneContent: {
    alignItems: "center",
    gap: 24,
    width: "100%",
  },
  resultCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  resultScore: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
  },
  resultLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metrics: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  metricCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  metricValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
  },
  metricLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bottomArea: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  limitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  limitText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
  },
  startBtnText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  cancelBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
  },
  doneButtons: {
    flexDirection: "row",
    gap: 12,
  },
  retryBtn: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
});
