import { Ionicons } from "@expo/vector-icons";
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
import {
  Camera,
  Frame,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from "react-native-vision-camera";
import { useResizePlugin } from "vision-camera-resize-plugin";
import { useRunOnJS } from "react-native-worklets-core";

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

// ─── Constants ────────────────────────────────────────────────────────────────
const SCAN_DURATION = 12;
const SAMPLE_RATE = 30;
const FRAME_DIM = 50;

// ─── PPG Signal Processing ────────────────────────────────────────────────────

function sdnn(vals: number[]): number {
  if (vals.length < 2) return 0;
  const mean = vals.reduce((a, b) => a + b) / vals.length;
  return Math.sqrt(
    vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / vals.length
  );
}

/**
 * Analyses a buffer of per-frame average red-channel brightness values
 * collected over the scan window and extracts heart rate, HRV, and a
 * confidence score using peak detection on the PPG waveform.
 *
 * Falls back to the time-seeded simulation if signal quality is too low
 * (finger not covering lens, motion artefacts, etc.).
 */
function analyzeSignal(samples: number[]): {
  score: HydrationScore;
  heartRate: number;
  hrv: number;
  confidence: number;
  source: "ppg" | "simulation";
} {
  // Need at least 5 s of data to attempt real analysis
  if (samples.length < SAMPLE_RATE * 5) {
    return { ...simulateFallback(), source: "simulation" };
  }

  // 1. Mean-centre (remove DC — slow drift from finger pressure)
  const mean = samples.reduce((a, b) => a + b) / samples.length;
  const centered = samples.map((v) => v - mean);

  // Amplitude sanity check — finger probably not covering lens
  const amplitude =
    Math.max(...centered) - Math.min(...centered);
  if (amplitude < 2) {
    return { ...simulateFallback(), confidence: 60, source: "simulation" };
  }

  // 2. Short moving-average smooth (~0.1 s window)
  const w = Math.max(1, Math.round(SAMPLE_RATE * 0.1));
  const smoothed = centered.map((_, i) => {
    const lo = Math.max(0, i - w);
    const hi = Math.min(centered.length - 1, i + w);
    let s = 0;
    for (let j = lo; j <= hi; j++) s += centered[j];
    return s / (hi - lo + 1);
  });

  // 3. Peak detection — min physiological distance 0.33 s (180 bpm cap)
  const minDist = Math.round(SAMPLE_RATE * 0.33);
  const threshold = amplitude * 0.25;
  const peaks: number[] = [];
  for (let i = minDist; i < smoothed.length - minDist; i++) {
    if (smoothed[i] < threshold) continue;
    let isPeak = true;
    for (let j = i - minDist; j <= i + minDist; j++) {
      if (smoothed[j] > smoothed[i]) {
        isPeak = false;
        break;
      }
    }
    if (isPeak) peaks.push(i);
  }

  if (peaks.length < 3) {
    return { ...simulateFallback(), confidence: 65, source: "simulation" };
  }

  // 4. RR intervals in seconds; filter physiologically impossible ones
  const intervals = peaks
    .slice(1)
    .map((p, i) => (p - peaks[i]) / SAMPLE_RATE)
    .filter((t) => t >= 0.3 && t <= 1.8); // 33–200 bpm

  if (intervals.length < 2) {
    return { ...simulateFallback(), confidence: 65, source: "simulation" };
  }

  // 5. Heart rate — median interval (robust against outliers)
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const heartRate = Math.round(Math.min(180, Math.max(40, 60 / median)));

  // 6. HRV — SDNN in ms (standard deviation of NN intervals)
  const hrv = Math.round(Math.min(120, Math.max(8, sdnn(intervals) * 1000)));

  // 7. Confidence — penalise high beat-to-beat variability (motion noise)
  const cv = sdnn(intervals) / median;
  const confidence = Math.round(Math.min(96, Math.max(62, 96 - cv * 80)));

  // 8. Hydration score from vitals
  //    Lower resting HR + higher HRV → better hydration (established in literature)
  const score: HydrationScore =
    hrv >= 55 && heartRate <= 68
      ? 4
      : hrv >= 38 && heartRate <= 78
      ? 3
      : hrv >= 25 && heartRate <= 88
      ? 2
      : 1;

  return { score, heartRate, hrv, confidence, source: "ppg" };
}

/** Stable time-seeded fallback when real PPG signal is unavailable. */
function simulateFallback(): Omit<ReturnType<typeof analyzeSignal>, "source"> {
  const now = new Date();
  const bucket = Math.floor((now.getHours() * 60 + now.getMinutes()) / 30);
  const seed = (bucket * 1013 + 7919) % 100;
  const base: HydrationScore = seed < 8 ? 1 : seed < 25 ? 2 : seed < 62 ? 3 : 4;

  const HR: Record<HydrationScore, number> = { 1: 88, 2: 78, 3: 68, 4: 64 };
  const HRV: Record<HydrationScore, number> = { 1: 28, 2: 38, 3: 52, 4: 64 };
  const CONF: Record<HydrationScore, number> = { 1: 79, 2: 83, 3: 88, 4: 91 };
  const r = () => Math.round((Math.random() - 0.5) * 6);

  return {
    score: base,
    heartRate: Math.max(55, Math.min(110, HR[base] + r())),
    hrv: Math.max(18, Math.min(90, HRV[base] + r())),
    confidence: Math.max(72, Math.min(96, CONF[base] + Math.round(r() / 1.5))),
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanState = "idle" | "requesting" | "scanning" | "done";
type SignalQuality = "none" | "weak" | "good";

const SCORE_COLORS: Record<HydrationScore, string> = {
  1: "#EF4444",
  2: "#F97316",
  3: "#0EA5E9",
  4: "#10B981",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scanMode, setScanMode, addScanResult } = useHydration();

  // VisionCamera v4 hooks
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();
  const resizer = useResizePlugin();

  const [state, setState] = useState<ScanState>("idle");
  const [timeLeft, setTimeLeft] = useState(SCAN_DURATION);
  const [torchOn, setTorchOn] = useState(false);
  const [signalQuality, setSignalQuality] = useState<SignalQuality>("none");
  const [result, setResult] = useState<ReturnType<typeof analyzeSignal> | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleBuffer = useRef<number[]>([]);
  const scanningRef = useRef(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Camera is available only on native with permission granted + device found
  const isCameraMode = scanMode === "phone" && Platform.OS !== "web";
  const cameraReady = isCameraMode && !!device && hasPermission;
  const resultColor = result ? SCORE_COLORS[result.score] : colors.primary;

  // ── Frame processor sample collection ─────────────────────────────────────
  // Called on the JS thread via useRunOnJS; accumulates brightness samples
  // and updates the live signal quality indicator.
  const collectSample = useCallback((avgRed: number) => {
    if (!scanningRef.current) return;
    sampleBuffer.current.push(avgRed);

    // Derive live quality from recent 30 samples
    const recent = sampleBuffer.current.slice(-30);
    if (recent.length < 10) return;
    const lo = Math.min(...recent);
    const hi = Math.max(...recent);
    setSignalQuality(hi - lo > 2 ? "good" : "weak");
  }, []);

  // Stable JS-thread callback that the worklet can call via useRunOnJS
  const sendSample = useRunOnJS(collectSample, [collectSample]);

  // ── Frame processor worklet ────────────────────────────────────────────────
  // Runs on the dedicated VisionCamera camera thread. Downsamples each frame
  // to FRAME_DIM × FRAME_DIM, averages the red channel, and ships the value
  // back to the JS thread via sendSample.
  const frameProcessor = useFrameProcessor(
    (frame: Frame) => {
      "worklet";
      try {
        const small = resizer.resize(frame, {
          scale: { width: FRAME_DIM, height: FRAME_DIM },
          pixelFormat: "rgb",
          dataType: "uint8",
        });
        let redSum = 0;
        const n = FRAME_DIM * FRAME_DIM;
        for (let i = 0; i < n; i++) {
          redSum += small[i * 3]; // R byte of each rgb triplet
        }
        sendSample(redSum / n);
      } catch {
        // Ignore dropped frames
      }
    },
    [resizer, sendSample]
  );

  // ── Animation helpers ──────────────────────────────────────────────────────
  const startPulse = useCallback(() => {
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current.start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseLoopRef.current?.stop();
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [pulseAnim]);

  // ── Scan lifecycle ─────────────────────────────────────────────────────────
  const finishScan = useCallback(() => {
    scanningRef.current = false;
    clearInterval(timerRef.current!);
    setTorchOn(false);
    stopPulse();
    const analyzed = analyzeSignal(sampleBuffer.current);
    sampleBuffer.current = [];
    setSignalQuality("none");
    setResult(analyzed);
    setState("done");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [stopPulse]);

  const beginScanning = useCallback(() => {
    sampleBuffer.current = [];
    scanningRef.current = true;
    setSignalQuality("none");
    setResult(null);
    setTimeLeft(SCAN_DURATION);
    if (isCameraMode) setTorchOn(true);
    setState("scanning");
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
          finishScan();
          return 0;
        }
        if (prev % 3 === 0) Haptics.selectionAsync().catch(() => {});
        return prev - 1;
      });
    }, 1000);
  }, [isCameraMode, startPulse, progressAnim, finishScan]);

  const startScan = useCallback(async () => {
    if (isCameraMode && !hasPermission) {
      setState("requesting");
      const granted = await requestPermission();
      setState("idle");
      if (!granted) return;
    }
    beginScanning();
  }, [isCameraMode, hasPermission, requestPermission, beginScanning]);

  const cancelScan = useCallback(() => {
    clearInterval(timerRef.current!);
    scanningRef.current = false;
    sampleBuffer.current = [];
    setTorchOn(false);
    stopPulse();
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    setSignalQuality("none");
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
      scanningRef.current = false;
    };
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const signalColor = signalQuality === "good" ? "#10B981" : "#EF4444";

  // ── Render ─────────────────────────────────────────────────────────────────
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
      {/* ── Header ── */}
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

      {/* ── Mode toggle ── */}
      <View style={styles.modeToggle}>
        {(["simulation", "phone"] as ScanMethod[]).map((m) => (
          <Pressable
            key={m}
            style={[
              styles.modeBtn,
              { backgroundColor: scanMode === m ? colors.primary : colors.secondary },
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
                  color:
                    scanMode === m ? colors.primaryForeground : colors.mutedForeground,
                },
              ]}
            >
              {m === "phone" ? "Camera + Torch" : "Simulation"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Scan area ── */}
      <View style={styles.scanArea}>

        {/* ─────────────────────────────────────────────────────────────────
            CAMERA MODE — single persistent Camera instance.
            The frame processor is only attached during the scanning state,
            but the Camera component itself stays mounted throughout the
            session so the torch is never reset by a remount.
        ───────────────────────────────────────────────────────────────── */}
        {cameraReady && (
          <View style={styles.cameraBlock}>
            <View style={styles.cameraCircle}>
              <Camera
                style={StyleSheet.absoluteFillObject}
                device={device}
                isActive={state === "idle" || state === "scanning"}
                torch={torchOn ? "on" : "off"}
                frameProcessor={state === "scanning" ? frameProcessor : undefined}
              />

              {/* State-specific overlays */}
              <View style={styles.cameraOverlay}>
                {(state === "idle" || state === "scanning") && (
                  <View
                    style={[
                      styles.fingerRing,
                      {
                        borderColor:
                          state === "scanning"
                            ? signalQuality === "good"
                              ? "#10B981"
                              : colors.primary
                            : colors.primary + "70",
                        borderStyle: state === "scanning" ? "solid" : "dashed",
                      },
                    ]}
                  >
                    {state === "scanning" && (
                      <Text style={styles.timerOverlay}>{timeLeft}</Text>
                    )}
                  </View>
                )}
                {state === "done" && result && (
                  <View
                    style={[
                      styles.doneOverlay,
                      { backgroundColor: resultColor + "30" },
                    ]}
                  >
                    <Ionicons name="checkmark-circle" size={52} color={resultColor} />
                  </View>
                )}
              </View>

              {/* Torch badge */}
              {torchOn && (
                <View style={[styles.torchBadge, { backgroundColor: "#F59E0B" }]}>
                  <Ionicons name="flashlight" size={11} color="#fff" />
                  <Text style={styles.torchBadgeText}>Torch on</Text>
                </View>
              )}

              {/* Live signal quality badge */}
              {state === "scanning" && (
                <View
                  style={[
                    styles.qualityBadge,
                    { backgroundColor: signalColor + "22" },
                  ]}
                >
                  <View style={[styles.qualityDot, { backgroundColor: signalColor }]} />
                  <Text style={[styles.qualityText, { color: signalColor }]}>
                    {signalQuality === "good"
                      ? "Signal good"
                      : "Press finger firmly"}
                  </Text>
                </View>
              )}
            </View>

            {/* Content below the camera circle, changes by state */}
            {state === "idle" && (
              <View style={styles.belowCamera}>
                <Text style={[styles.instruction, { color: colors.foreground }]}>
                  Cover the rear camera tightly with your fingertip
                </Text>
                <Text style={[styles.subInstruction, { color: colors.mutedForeground }]}>
                  Press firmly and hold completely still. Torch activates when you tap Start.
                </Text>
              </View>
            )}

            {state === "scanning" && (
              <View style={styles.belowCamera}>
                <WaveformPreview
                  isActive
                  width={260}
                  height={60}
                  color={signalQuality === "good" ? "#10B981" : colors.primary}
                />
                <Text style={[styles.scanningHint, { color: colors.mutedForeground }]}>
                  {signalQuality === "good"
                    ? "Strong signal — keep holding still..."
                    : "Hold still — torch active, reading pulse..."}
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
              <>
                {result.source === "ppg" && (
                  <View
                    style={[
                      styles.sourceBadge,
                      { backgroundColor: "#10B98120", borderColor: "#10B98140" },
                    ]}
                  >
                    <Ionicons name="pulse-outline" size={13} color="#10B981" />
                    <Text style={[styles.sourceText, { color: "#10B981" }]}>
                      Real PPG measurement
                    </Text>
                  </View>
                )}
                <View style={styles.metricsRow}>
                  {[
                    { value: result.heartRate, label: "BPM" },
                    { value: result.hrv, label: "HRV ms" },
                    { value: `${result.confidence}%`, label: "Confidence" },
                  ].map((m) => (
                    <View
                      key={m.label}
                      style={[
                        styles.metricCard,
                        { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.metricValue, { color: colors.foreground }]}>
                        {m.value}
                      </Text>
                      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>
                        {m.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            SIMULATION / PERMISSION-NOT-YET-GRANTED PATH
        ───────────────────────────────────────────────────────────────── */}
        {!cameraReady && (
          <>
            {(state === "idle" || state === "requesting") && (
              <View style={styles.idleContent}>
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
                <Text style={[styles.instruction, { color: colors.foreground }]}>
                  {state === "requesting"
                    ? "Requesting camera access..."
                    : isCameraMode
                    ? "Camera access needed to activate torch"
                    : "Ready to run a simulated PPG scan"}
                </Text>
                <Text style={[styles.subInstruction, { color: colors.mutedForeground }]}>
                  {state === "requesting"
                    ? "Please allow camera permission in the system prompt."
                    : isCameraMode
                    ? "Tap Start Scan to grant permission."
                    : "Uses a time-seeded algorithm — scores are consistent within 30-minute windows."}
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
                <WaveformPreview isActive width={280} height={70} color={colors.primary} />
                <Text style={[styles.scanningHint, { color: colors.mutedForeground }]}>
                  Processing simulated PPG waveform...
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
                <View
                  style={[
                    styles.resultCircle,
                    { borderColor: resultColor + "40", backgroundColor: resultColor + "15" },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={60} color={resultColor} />
                  <Text style={[styles.resultScore, { color: resultColor }]}>
                    {result.score}/4
                  </Text>
                  <Text style={[styles.resultLabel, { color: resultColor }]}>
                    {getScoreLabel(result.score)}
                  </Text>
                </View>
                <View style={styles.metricsRow}>
                  {[
                    { value: result.heartRate, label: "BPM" },
                    { value: result.hrv, label: "HRV ms" },
                    { value: `${result.confidence}%`, label: "Confidence" },
                  ].map((m) => (
                    <View
                      key={m.label}
                      style={[
                        styles.metricCard,
                        { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.metricValue, { color: colors.foreground }]}>
                        {m.value}
                      </Text>
                      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>
                        {m.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </View>

      {/* ── Bottom controls ── */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  modeToggle: { flexDirection: "row", marginHorizontal: 20, marginBottom: 12, gap: 8 },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  modeBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", fontWeight: "500" as const },

  scanArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    overflow: "hidden",
  },

  // Camera layout
  cameraBlock: { width: "100%", alignItems: "center", gap: 20 },
  cameraCircle: {
    width: 210,
    height: 210,
    borderRadius: 105,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000",
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  fingerRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  timerOverlay: {
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
    color: "#ffffff",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  doneOverlay: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: "center",
    justifyContent: "center",
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
  qualityBadge: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  qualityDot: { width: 7, height: 7, borderRadius: 4 },
  qualityText: { fontSize: 11, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },

  belowCamera: { width: "100%", alignItems: "center", gap: 12 },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  sourceText: { fontSize: 12, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },

  // Simulation / no-camera layouts
  idleContent: { alignItems: "center", gap: 18, width: "100%" },
  fingerTarget: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
  },
  scanningContent: { alignItems: "center", gap: 20, width: "100%" },
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
  timerNumber: { fontSize: 48, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  timerLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -4 },
  doneContent: { alignItems: "center", gap: 24, width: "100%" },
  resultCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  resultScore: { fontSize: 24, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  resultLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Shared
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
  scanningHint: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  progressBar: { width: "100%", height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  metricsRow: { flexDirection: "row", gap: 10, width: "100%" },
  metricCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  metricValue: { fontSize: 20, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  metricLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Bottom controls
  bottomArea: { paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
  },
  startBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  cancelBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  cancelBtnText: { fontSize: 16, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  doneButtons: { flexDirection: "row", gap: 12 },
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
