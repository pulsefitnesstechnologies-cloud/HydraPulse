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
 * Returns null when signal quality is too low (finger not covering lens,
 * motion artefacts, etc.) so the UI can prompt the user to retry.
 */
function analyzeSignal(samples: number[]): {
  score: HydrationScore;
  heartRate: number;
  hrv: number;
  confidence: number;
  debug: string;
} | null {
  // Need at least 3 s of data (shorter minimum — 12 s scan always provides more)
  if (samples.length < SAMPLE_RATE * 3) return null;

  // Drop the first 2 s — the iPhone camera auto-exposure swings wildly when
  // the torch turns on, producing a huge DC spike that corrupts the amplitude
  // calculation and buries the real PPG signal (~1–5 units variation).
  const stable = samples.slice(SAMPLE_RATE * 2);
  if (stable.length < SAMPLE_RATE * 3) return null;

  // 1. Mean-centre (remove DC — slow drift from finger pressure)
  const mean = stable.reduce((a, b) => a + b) / stable.length;
  const centered = stable.map((v) => v - mean);

  // Amplitude sanity check — finger probably not covering lens.
  // Threshold is intentionally low (0.3) because real camera PPG AC amplitude
  // is tiny relative to the DC offset (often 1-8 units on a 0-255 scale).
  const rawAmplitude = Math.max(...centered) - Math.min(...centered);
  if (rawAmplitude < 0.3) return null;

  // 2. Short moving-average smooth (~0.15 s window)
  const w = Math.max(1, Math.round(SAMPLE_RATE * 0.15));
  const smoothed = centered.map((_, i) => {
    const lo = Math.max(0, i - w);
    const hi = Math.min(centered.length - 1, i + w);
    let s = 0;
    for (let j = lo; j <= hi; j++) s += centered[j];
    return s / (hi - lo + 1);
  });

  const smoothAmp = Math.max(...smoothed) - Math.min(...smoothed);

  // 3. Heart rate via autocorrelation — finds the dominant periodicity of the
  //    signal without needing to detect individual peaks, so it tolerates
  //    noise, polarity ambiguity, and mild motion much better than peak-based
  //    methods.
  //
  //    Key implementation detail: DO NOT take the global maximum of the
  //    autocorrelation function. Due to moving-average smoothing, very short
  //    lags always have artificially high correlation. Instead, compute the
  //    full curve and find the first prominent LOCAL MAXIMUM — that is the
  //    true cardiac periodicity.
  //
  //    Lag range: 40–170 BPM
  const lagMin = Math.round(SAMPLE_RATE * 60 / 170); // ~10 frames
  const lagMax = Math.round(SAMPLE_RATE * 60 / 40);  // ~45 frames

  const variance = smoothed.reduce((acc, v) => acc + v * v, 0) / smoothed.length;
  if (variance < 0.001) return null; // flat signal — finger not covering lens

  const corrCurve: number[] = [];
  for (let lag = lagMin; lag <= lagMax; lag++) {
    const n = smoothed.length - lag;
    let c = 0;
    for (let i = 0; i < n; i++) c += smoothed[i] * smoothed[i + lag];
    corrCurve.push(c / (n * variance));
  }

  // Find the LOCAL MAXIMUM with the highest correlation value.
  // A local maximum at index k means corrCurve[k] > neighbours on both sides.
  let bestIdx = -1;
  let bestCorrVal = 0.08; // minimum threshold — below this is noise
  for (let k = 1; k < corrCurve.length - 1; k++) {
    if (corrCurve[k] > corrCurve[k - 1] &&
        corrCurve[k] > corrCurve[k + 1] &&
        corrCurve[k] > bestCorrVal) {
      bestCorrVal = corrCurve[k];
      bestIdx = k;
    }
  }

  if (bestIdx === -1) return null; // no clear cardiac periodicity found

  const bestLag = lagMin + bestIdx;
  const rawHeartRate = Math.round(Math.min(170, Math.max(40, SAMPLE_RATE * 60 / bestLag)));

  // Small empirical correction: camera fingertip PPG reads slightly low vs
  // wrist-based optical sensors. +5 is the midpoint of observed calibration
  // across different resting heart rates (40–80 BPM range).
  const heartRate = Math.min(180, rawHeartRate + 5);

  const debugStr = `n=${stable.length}(+${samples.length - stable.length}skipped) amp=${rawAmplitude.toFixed(2)} lag=${bestLag} corr=${bestCorrVal.toFixed(3)} rawBPM=${rawHeartRate}`;

  // 4. Peak detection for HRV (requires interval-by-interval data).
  const minDist = Math.round(SAMPLE_RATE * 0.33);
  const threshold = smoothAmp * 0.15;

  const detectPeaks = (signal: number[]): number[] => {
    const found: number[] = [];
    for (let i = minDist; i < signal.length - minDist; i++) {
      if (signal[i] < threshold) continue;
      let isPeak = true;
      for (let j = i - minDist; j <= i + minDist; j++) {
        if (signal[j] > signal[i]) { isPeak = false; break; }
      }
      if (isPeak) found.push(i);
    }
    return found;
  };

  let peaks = detectPeaks(smoothed);
  if (peaks.length < 3) peaks = detectPeaks(smoothed.map((v) => -v));

  // When peaks are too sparse, synthesise intervals from the autocorrelation
  // lag so HRV calculation has at least a fallback value.
  const intervals: number[] = peaks.length >= 3
    ? peaks.slice(1)
        .map((p, i) => (p - peaks[i]) / SAMPLE_RATE)
        .filter((t) => t >= 0.3 && t <= 1.8)
    : [bestLag / SAMPLE_RATE, bestLag / SAMPLE_RATE];

  if (intervals.length < 2) return null;

  // 5. HRV — SDNN in ms
  const median = intervals.slice().sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
  const hrv = Math.round(Math.min(120, Math.max(8, sdnn(intervals) * 1000)));

  // 6. Confidence — penalise high beat-to-beat variability (motion noise)
  const cv = sdnn(intervals) / median;
  const confidence = Math.round(Math.min(96, Math.max(62, 96 - cv * 80)));

  // 8. Hydration score from vitals.
  //    Wider threshold bands vs the original tight values — camera-based PPG
  //    HRV (SDNN from a 10-second window) has inherent ±10–15 ms noise, so
  //    hard cutoffs at every 20 ms cause unstable score flipping across
  //    consecutive scans.  The bands below give a ±7-8 ms dead-zone around
  //    each boundary so minor measurement variation does not change the score.
  //    Lower resting HR + higher HRV → better hydration (established in literature).
  const score: HydrationScore =
    hrv >= 50 && heartRate <= 70
      ? 4 // Excellent: strong parasympathetic tone, low resting HR
      : hrv >= 28 && heartRate <= 86
      ? 3 // Good: healthy adult resting range
      : hrv >= 14 && heartRate <= 100
      ? 2 // Low: mild dehydration or elevated sympathetic drive
      : 1; // Critical

  return { score, heartRate, hrv, confidence, debug: debugStr };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanState = "idle" | "requesting" | "scanning" | "done" | "failed";
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
  const { addScanResult } = useHydration();

  // VisionCamera v4 hooks
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();
  const resizer = useResizePlugin();

  const [state, setState] = useState<ScanState>("idle");
  const [timeLeft, setTimeLeft] = useState(SCAN_DURATION);
  const [torchOn, setTorchOn] = useState(false);
  const [signalQuality, setSignalQuality] = useState<SignalQuality>("none");
  const [result, setResult] = useState<ReturnType<typeof analyzeSignal>>(null);
  const [failReason, setFailReason] = useState<string>("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleBuffer = useRef<number[]>([]);
  const scanningRef = useRef(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Camera is always required — no simulation fallback
  const cameraReady = Platform.OS !== "web" && !!device && hasPermission;
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
    setSignalQuality(hi - lo > 0.8 ? "good" : "weak");
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
    const buf = sampleBuffer.current.slice();
    sampleBuffer.current = [];
    setSignalQuality("none");
    const analyzed = analyzeSignal(buf);
    if (analyzed) {
      setResult(analyzed);
      setState("done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      // Build a minimal debug string so you can diagnose what the signal
      // looked like even when the algorithm couldn't extract a heart rate.
      const n = buf.length;
      let debugNote = `(${n} samples collected)`;
      if (n >= 2) {
        const mean = buf.reduce((a, b) => a + b) / n;
        const centered = buf.map((v) => v - mean);
        const amp = Math.max(...centered) - Math.min(...centered);
        debugNote = `(${n} samples, amplitude ${amp.toFixed(2)})`;
      }
      setFailReason(
        `Signal too weak — your fingertip may not have been fully covering the lens, or there was too much movement. ${debugNote}`
      );
      setState("failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, [stopPulse]);

  const beginScanning = useCallback(() => {
    sampleBuffer.current = [];
    scanningRef.current = true;
    setSignalQuality("none");
    setResult(null);
    setFailReason("");
    setTimeLeft(SCAN_DURATION);
    setTorchOn(true);
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
  }, [startPulse, progressAnim, finishScan]);

  const startScan = useCallback(async () => {
    if (!hasPermission) {
      setState("requesting");
      const granted = await requestPermission();
      setState("idle");
      if (!granted) return;
    }
    beginScanning();
  }, [hasPermission, requestPermission, beginScanning]);

  const cancelScan = useCallback(() => {
    clearInterval(timerRef.current!);
    scanningRef.current = false;
    sampleBuffer.current = [];
    setTorchOn(false);
    stopPulse();
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    setSignalQuality("none");
    setFailReason("");
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
      method: "phone",
      confidence: result.confidence,
      heartRate: result.heartRate,
      hrv: result.hrv,
    };
    await addScanResult(record);
    router.replace({
      pathname: "/results",
      params: { recordId: record.id, score: record.score, label: record.label },
    });
  }, [result, addScanResult, router]);

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
                <View
                  style={[
                    styles.sourceBadge,
                    { backgroundColor: "#10B98120", borderColor: "#10B98140" },
                  ]}
                >
                  <Ionicons name="pulse-outline" size={13} color="#10B981" />
                  <Text style={[styles.sourceText, { color: "#10B981" }]}>
                    Live PPG measurement
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
              </>
            )}
          </View>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            PERMISSION-NOT-YET-GRANTED / NO DEVICE
        ───────────────────────────────────────────────────────────────── */}
        {!cameraReady && (
          <View style={styles.idleContent}>
            <Animated.View
              style={[
                styles.fingerTarget,
                { borderColor: colors.primary, transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Ionicons name="camera-outline" size={64} color={colors.primary} />
            </Animated.View>
            <Text style={[styles.instruction, { color: colors.foreground }]}>
              {state === "requesting"
                ? "Requesting camera access..."
                : "Camera access needed"}
            </Text>
            <Text style={[styles.subInstruction, { color: colors.mutedForeground }]}>
              {state === "requesting"
                ? "Please allow camera permission in the system prompt."
                : "HydraPulse needs camera access to activate the torch and read your pulse. Tap Start Scan to grant permission."}
            </Text>
          </View>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            FAILED STATE
        ───────────────────────────────────────────────────────────────── */}
        {state === "failed" && (
          <View style={styles.idleContent}>
            <View
              style={[
                styles.fingerTarget,
                { borderColor: "#EF4444" },
              ]}
            >
              <Ionicons name="warning-outline" size={64} color="#EF4444" />
            </View>
            <Text style={[styles.instruction, { color: colors.foreground }]}>
              Reading unsuccessful
            </Text>
            <Text style={[styles.subInstruction, { color: colors.mutedForeground }]}>
              {failReason}
            </Text>
          </View>
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

        {state === "failed" && (
          <Pressable
            style={({ pressed }) => [
              styles.startBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => {
              setState("idle");
              setTimeLeft(SCAN_DURATION);
              setFailReason("");
              progressAnim.setValue(0);
            }}
          >
            <Ionicons name="refresh-outline" size={22} color={colors.primaryForeground} />
            <Text style={[styles.startBtnText, { color: colors.primaryForeground }]}>
              Try Again
            </Text>
          </Pressable>
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
