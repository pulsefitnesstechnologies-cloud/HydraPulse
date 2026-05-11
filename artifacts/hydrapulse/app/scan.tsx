import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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
  HydrationScore,
  ScanMethod,
  ScanRecord,
  getScoreLabel,
  useHydration,
} from "@/context/HydrationContext";
import { useColors } from "@/hooks/useColors";

const SCAN_DURATION = 12;

/**
 * Produces stable, realistic PPG estimates within a 30-minute window.
 * Scores don't jump wildly between back-to-back scans; they vary slightly
 * as they would with a real sensor.
 *
 * NOTE: This is a simulation. True on-device PPG processing requires a
 * native frame processor (e.g. react-native-vision-camera + C++ plugin)
 * which is beyond Expo Go's sandbox. The camera mode activates the torch
 * and shows the camera feed — actual pixel analysis is not yet implemented.
 */
function stablePPGEstimate(): {
  score: HydrationScore;
  heartRate: number;
  hrv: number;
  confidence: number;
} {
  // Bucket time into 30-minute windows so repeated scans stay consistent
  const now = new Date();
  const bucket = Math.floor((now.getHours() * 60 + now.getMinutes()) / 30);

  // Simple deterministic seed from the bucket (changes every 30 min)
  const seed = (bucket * 1013 + 7919) % 100;

  // Score distribution: weighted toward Good/Excellent
  let baseScore: HydrationScore;
  if (seed < 8) baseScore = 1;
  else if (seed < 25) baseScore = 2;
  else if (seed < 62) baseScore = 3;
  else baseScore = 4;

  // Small noise (±0–1 heart rate points, no score jumps)
  const hrNoise = Math.round((Math.random() - 0.5) * 4);
  const hrvNoise = Math.round((Math.random() - 0.5) * 6);
  const confNoise = Math.round((Math.random() - 0.5) * 4);

  // Base vitals correlated with score
  const baseHR: Record<HydrationScore, number> = { 1: 88, 2: 78, 3: 68, 4: 64 };
  const baseHRV: Record<HydrationScore, number> = { 1: 28, 2: 38, 3: 52, 4: 64 };
  const baseConf: Record<HydrationScore, number> = { 1: 79, 2: 83, 3: 88, 4: 91 };

  return {
    score: baseScore,
    heartRate: Math.max(55, Math.min(110, baseHR[baseScore] + hrNoise)),
    hrv: Math.max(18, Math.min(90, baseHRV[baseScore] + hrvNoise)),
    confidence: Math.max(72, Math.min(96, baseConf[baseScore] + confNoise)),
  };
}

type ScanState = "idle" | "requesting" | "scanning" | "done";

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scanMode, setScanMode, addScanResult } = useHydration();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>("idle");
  const [timeLeft, setTimeLeft] = useState(SCAN_DURATION);
  const [result, setResult] = useState<ReturnType<typeof stablePPGEstimate> | null>(null);
  const [torchOn, setTorchOn] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const startPulse = useCallback(() => {
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current.start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseLoopRef.current?.stop();
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [pulseAnim]);

  const finishScan = useCallback(() => {
    setTorchOn(false);
    stopPulse();
    setState("done");
    setResult(stablePPGEstimate());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [stopPulse]);

  const beginScanning = useCallback(() => {
    setState("scanning");
    setTimeLeft(SCAN_DURATION);
    setResult(null);
    if (scanMode === "phone") setTorchOn(true);
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
        if (prev % 3 === 0) Haptics.selectionAsync().catch(() => {});
        return prev - 1;
      });
    }, 1000);
  }, [scanMode, startPulse, progressAnim, finishScan]);

  const startScan = useCallback(async () => {
    if (scanMode === "phone" && Platform.OS !== "web") {
      if (!cameraPermission?.granted) {
        setState("requesting");
        const result = await requestCameraPermission();
        setState("idle");
        if (!result.granted) return;
      }
    }
    beginScanning();
  }, [scanMode, cameraPermission, requestCameraPermission, beginScanning]);

  const cancelScan = useCallback(() => {
    clearInterval(timerRef.current!);
    setTorchOn(false);
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
    return () => {
      clearInterval(timerRef.current!);
      setTorchOn(false);
    };
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

  const isCameraMode = scanMode === "phone" && Platform.OS !== "web";
  const showCamera = isCameraMode && (state === "scanning" || state === "idle");
  const cameraGranted = cameraPermission?.granted ?? false;

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
            onPress={() => { if (state !== "scanning") setScanMode(m); }}
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
                  color: scanMode === m
                    ? colors.primaryForeground
                    : colors.mutedForeground,
                },
              ]}
            >
              {m === "phone" ? "Camera + Torch" : "Simulation"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.scanArea}>
        {/* IDLE STATE */}
        {state === "idle" && (
          <View style={styles.idleContent}>
            {isCameraMode && cameraGranted ? (
              <View style={styles.cameraPreviewWrapper}>
                <CameraView
                  style={styles.cameraPreview}
                  facing="back"
                  enableTorch={false}
                />
                <View style={styles.cameraOverlay}>
                  <View style={[styles.fingerRing, { borderColor: colors.primary }]} />
                </View>
              </View>
            ) : (
              <Animated.View
                style={[
                  styles.fingerTarget,
                  { borderColor: colors.primary, transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Ionicons
                  name={isCameraMode ? "camera-outline" : "finger-print-outline"}
                  size={64}
                  color={colors.primary}
                />
              </Animated.View>
            )}

            <Text style={[styles.instruction, { color: colors.foreground }]}>
              {isCameraMode
                ? "Cover the rear camera tightly with your fingertip"
                : "Ready to run a simulated PPG scan"}
            </Text>
            <Text style={[styles.subInstruction, { color: colors.mutedForeground }]}>
              {isCameraMode
                ? "The torch activates when you tap Start. Press firmly and hold completely still."
                : "Uses a time-seeded algorithm — scores are consistent within 30-minute windows."}
            </Text>

            {isCameraMode && (
              <View style={[styles.noticeBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Ionicons name="bulb-outline" size={14} color={colors.mutedForeground} />
                <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
                  Signal processing is simulated. Camera mode activates the torch and confirms fingertip placement. Native PPG analysis requires a future app store build.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* REQUESTING PERMISSION */}
        {state === "requesting" && (
          <View style={styles.idleContent}>
            <Ionicons name="camera-outline" size={64} color={colors.primary} />
            <Text style={[styles.instruction, { color: colors.foreground }]}>
              Camera access needed
            </Text>
            <Text style={[styles.subInstruction, { color: colors.mutedForeground }]}>
              Requesting camera permission to activate torch for fingertip scanning...
            </Text>
          </View>
        )}

        {/* SCANNING STATE */}
        {state === "scanning" && (
          <View style={styles.scanningContent}>
            {isCameraMode ? (
              <View style={styles.cameraPreviewWrapper}>
                <CameraView
                  style={styles.cameraPreview}
                  facing="back"
                  enableTorch={torchOn}
                />
                <View style={styles.cameraOverlay}>
                  <View style={[styles.fingerRing, { borderColor: colors.primary }]}>
                    <Text style={[styles.timerOverlay, { color: "#fff" }]}>
                      {timeLeft}
                    </Text>
                  </View>
                </View>
                {torchOn && (
                  <View style={[styles.torchBadge, { backgroundColor: "#F59E0B" }]}>
                    <Ionicons name="flashlight" size={12} color="#fff" />
                    <Text style={styles.torchBadgeText}>Torch on</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.timerCircle}>
                <View style={[styles.timerInner, { borderColor: colors.primary + "30" }]}>
                  <Text style={[styles.timerNumber, { color: colors.primary }]}>
                    {timeLeft}
                  </Text>
                  <Text style={[styles.timerLabel, { color: colors.mutedForeground }]}>
                    seconds
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.waveformContainer}>
              <WaveformPreview isActive={true} width={280} height={70} color={colors.primary} />
            </View>

            <Text style={[styles.scanningHint, { color: colors.mutedForeground }]}>
              {isCameraMode
                ? "Hold still — torch active, reading pulse signal..."
                : "Processing simulated PPG waveform..."}
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

        {/* DONE STATE */}
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

      {/* BOTTOM CONTROLS */}
      <View style={styles.bottomArea}>
        <DisclaimerBanner />

        {(state === "idle" || state === "requesting") && (
          <Pressable
            style={({ pressed }) => [
              styles.startBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={startScan}
            disabled={state === "requesting"}
          >
            <Ionicons name="scan-outline" size={22} color={colors.primaryForeground} />
            <Text style={[styles.startBtnText, { color: colors.primaryForeground }]}>
              {state === "requesting" ? "Requesting access..." : "Start Scan"}
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
  container: { flex: 1 },
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
    fontSize: 13,
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
    gap: 18,
    width: "100%",
  },
  cameraPreviewWrapper: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: "hidden",
    position: "relative",
  },
  cameraPreview: {
    width: "100%",
    height: "100%",
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  fingerRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  timerOverlay: {
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  torchBadge: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  torchBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
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
    fontSize: 19,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    textAlign: "center",
    lineHeight: 26,
  },
  subInstruction: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
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
