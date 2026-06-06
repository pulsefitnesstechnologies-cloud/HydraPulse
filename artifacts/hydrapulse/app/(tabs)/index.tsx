import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export { ErrorBoundary } from "@/components/ErrorBoundary";

import { DailyFactModal } from "@/components/DailyFactModal";
import { TodayBanner } from "@/components/TodayBanner";
import { ScoreGauge } from "@/components/ScoreGauge";
import { SkeletonBlock } from "@/components/SkeletonBlock";
import { StreakCelebration } from "@/components/StreakCelebration";
import { WeeklyReward } from "@/components/WeeklyReward";
import { TimePicker, TimeValue, formatTime } from "@/components/TimePicker";
import { TrendChart } from "@/components/TrendChart";
import { useDailyFact } from "@/hooks/useDailyFact";
import { useHealth } from "@/context/HealthContext";
import {
  getScoreColor,
  getScoreLabel,
  useHydration,
} from "@/context/HydrationContext";
import { useWaterIntake } from "@/context/WaterIntakeContext";
import { useColors } from "@/hooks/useColors";
import AsyncStorage from "@react-native-async-storage/async-storage";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Water Log Modal ──────────────────────────────────────────────────────────

function nowTimeValue(): TimeValue {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes();
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { hour: h, minute: m, ampm };
}

function WaterLogModal({
  visible,
  onClose,
  onLog,
}: {
  visible: boolean;
  onClose: () => void;
  onLog: (oz: number, time: string) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [amountText, setAmountText] = useState("");
  const [timeVal, setTimeVal] = useState<TimeValue>(nowTimeValue());

  // Reset to current time every time the modal opens
  useEffect(() => {
    if (visible) {
      setAmountText("");
      setTimeVal(nowTimeValue());
    }
  }, [visible]);

  const handleLog = () => {
    const oz = parseFloat(amountText);
    if (isNaN(oz) || oz <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount in fluid ounces.");
      return;
    }
    const now = new Date();
    let h = timeVal.hour;
    if (timeVal.ampm === "AM" && h === 12) h = 0;
    else if (timeVal.ampm === "PM" && h !== 12) h += 12;
    now.setHours(h, timeVal.minute, 0, 0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onLog(oz, now.toISOString());
    setAmountText("");
    setTimeVal(nowTimeValue());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <View
        style={[
          styles.modalSheet,
          { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 20 },
        ]}
      >
        <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
        <Text style={[styles.modalTitle, { color: colors.foreground }]}>Log Water Intake</Text>

        <View style={[styles.amountRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <TextInput
            style={[styles.amountInput, { color: colors.foreground }]}
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            value={amountText}
            onChangeText={setAmountText}
            returnKeyType="done"
            autoFocus
          />
          <Text style={[styles.amountUnit, { color: colors.mutedForeground }]}>fl oz</Text>
        </View>

        <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>Time Finished Drinking</Text>
        <View style={[styles.timePickerWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <TimePicker value={timeVal} onChange={setTimeVal} />
        </View>

        <View style={styles.modalActions}>
          <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
            <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.logBtn, { backgroundColor: "#0EA5E9" }]} onPress={handleLog}>
            <Ionicons name="water" size={16} color="#fff" />
            <Text style={styles.logBtnText}>Log</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function HomeLoadingSkeleton() {
  const colors = useColors();
  return (
    <View style={{ gap: 16 }}>
      <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SkeletonBlock width={130} height={13} borderRadius={6} />
        <View style={[styles.gaugeRow, { marginTop: 12 }]}>
          <SkeletonBlock width={180} height={180} borderRadius={90} />
          <View style={{ flex: 1, paddingLeft: 8, gap: 10 }}>
            <SkeletonBlock width="75%" height={22} borderRadius={11} />
            <SkeletonBlock width="55%" height={13} borderRadius={6} />
            <SkeletonBlock width="65%" height={13} borderRadius={6} />
          </View>
        </View>
        <SkeletonBlock height={46} borderRadius={10} style={{ marginTop: 12 }} />
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SkeletonBlock width={110} height={13} borderRadius={6} />
        <SkeletonBlock height={46} borderRadius={10} style={{ marginTop: 12 }} />
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SkeletonBlock width={90} height={13} borderRadius={6} />
        <SkeletonBlock height={110} borderRadius={8} style={{ marginTop: 12 }} />
      </View>
    </View>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────

const LAST_CELEBRATION_DATE_KEY  = "@hydrapulse:lastStreakCelebrationDate";
const LAST_WEEKLY_REWARD_KEY     = "@hydrapulse:lastWeeklyRewardMonday";

function getThisWeekMonday(): string {
  const d   = new Date();
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + offset);
  return mon.toISOString().split("T")[0];
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { latestScan, history, isLoaded, currentStreak, bestStreak, todayScans, scansThisWeek } = useHydration();
  const {
    healthKitEnabled,
    healthSnapshot,
    healthLoading,
    connectHealthKit,
    writeWaterLog,
    runWatchScan,
  } = useHealth();
  const { todayTotalOz, dailyGoalOz, addWaterLog } = useWaterIntake();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const dailyFact = useDailyFact();
  const [showWaterLog, setShowWaterLog] = useState(false);
  const [celebrationStreak, setCelebrationStreak] = useState<number | null>(null);
  const [showWeeklyReward, setShowWeeklyReward] = useState(false);

  const totalUniqueDays = React.useMemo(
    () => new Set(history.map((r) => r.date.split("T")[0])).size,
    [history]
  );

  // ── Inline watch scan ──────────────────────────────────────────────────────
  type WatchPhase = "idle" | "scanning" | "failed";
  const [watchPhase, setWatchPhase] = useState<WatchPhase>("idle");
  const [watchError, setWatchError] = useState("");

  // Fire celebration when home screen comes into focus — ensures the user
  // actually sees it rather than having it auto-dismiss while they were on
  // the results screen. Guard: only once per calendar day.
  useFocusEffect(
    useCallback(() => {
      if (!isLoaded || currentStreak === 0 || todayScans === 0) return;
      const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local time
      AsyncStorage.getItem(LAST_CELEBRATION_DATE_KEY)
        .then((lastDate) => {
          if (lastDate !== today) {
            setCelebrationStreak(currentStreak);
            AsyncStorage.setItem(LAST_CELEBRATION_DATE_KEY, today).catch(() => {});
          }
        })
        .catch(() => {});
    }, [isLoaded, currentStreak, todayScans])
  );

  // Weekly reward — once per calendar week when streak is active
  useFocusEffect(
    useCallback(() => {
      if (!isLoaded || currentStreak < 7 || scansThisWeek === 0) return;
      const monday = getThisWeekMonday();
      AsyncStorage.getItem(LAST_WEEKLY_REWARD_KEY)
        .then((last) => {
          if (last !== monday) {
            setShowWeeklyReward(true);
            AsyncStorage.setItem(LAST_WEEKLY_REWARD_KEY, monday).catch(() => {});
          }
        })
        .catch(() => {});
    }, [isLoaded, currentStreak, scansThisWeek])
  );

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const scoreColor = latestScan ? getScoreColor(latestScan.score) : colors.primary;

  const handleScan = (scanMode: "camera" | "watch" = "camera") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push({ pathname: "/scan", params: { mode: scanMode } });
  };

  const handleConnectHealth = async () => {
    await connectHealthKit();
  };

  // Runs watch scan inline — no navigation to the scan screen
  const handleWatchScan = async () => {
    if (!healthKitEnabled) { handleConnectHealth(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setWatchPhase("scanning");
    setWatchError("");
    try {
      const result = await runWatchScan();
      if (result === "not-worn") {
        setWatchError(
          "No heart rate data found. Make sure your Apple Watch is worn and HydraPulse has Health access enabled in Settings."
        );
        setWatchPhase("failed");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } else if (result) {
        setWatchPhase("idle");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.push({
          pathname: "/results",
          params: { recordId: result.id, score: result.score, label: result.label },
        });
      } else {
        setWatchError(
          "Could not read Watch data. Make sure your Apple Watch is paired and Health access is enabled."
        );
        setWatchPhase("failed");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    } catch {
      setWatchError("An error occurred reading Watch data. Please try again.");
      setWatchPhase("failed");
    }
  };

  const hasHealthData =
    healthKitEnabled && (healthSnapshot.heartRate !== null || healthSnapshot.hrv !== null);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === "web" ? insets.top + 67 : 0,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 100 + (Platform.OS === "web" ? 34 : 0) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
              {greeting()}
            </Text>
            <Text style={[styles.appName, { color: colors.foreground }]}>
              HydraPulse
            </Text>
          </View>
        </View>

        {!isLoaded ? (
          <HomeLoadingSkeleton />
        ) : (
          <Animated.View style={{ opacity: fadeAnim, gap: 12 }}>

          {/* ── Today banner: water rising + streak ────────────────────── */}
          <TodayBanner
            todayScans={todayScans}
            currentStreak={currentStreak}
            bestStreak={bestStreak}
            todayTotalOz={todayTotalOz}
            dailyGoalOz={dailyGoalOz}
            onLogWater={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setShowWaterLog(true);
            }}
          />

          {/* Main hydration score card */}
          <View
            style={[
              styles.scoreCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Current Hydration
            </Text>
            <View style={styles.gaugeRow}>
              <ScoreGauge score={latestScan?.score ?? null} size={180} />
              <View style={styles.gaugeInfo}>
                {latestScan ? (
                  <>
                    <View
                      style={[styles.statusBadge, { backgroundColor: scoreColor + "20" }]}
                    >
                      <Text style={[styles.statusText, { color: scoreColor }]}>
                        {getScoreLabel(latestScan.score)}
                      </Text>
                    </View>
                    <Text style={[styles.lastScanTime, { color: colors.mutedForeground }]}>
                      {timeAgo(latestScan.date)}
                    </Text>
                    {latestScan.heartRate && (
                      <View style={styles.metricMini}>
                        <Ionicons name="heart" size={14} color={colors.destructive} />
                        <Text style={[styles.metricMiniText, { color: colors.foreground }]}>
                          {latestScan.heartRate} BPM
                        </Text>
                      </View>
                    )}
                    {latestScan.hrv && (
                      <View style={styles.metricMini}>
                        <Ionicons name="pulse" size={14} color={colors.accent} />
                        <Text style={[styles.metricMiniText, { color: colors.foreground }]}>
                          HRV {latestScan.hrv}
                        </Text>
                      </View>
                    )}
                    <View style={styles.metricMini}>
                      <Ionicons
                        name={latestScan.method === "watch" ? "watch-outline" : "phone-portrait-outline"}
                        size={14}
                        color={colors.mutedForeground}
                      />
                      <Text style={[styles.methodLabel, { color: colors.mutedForeground }]}>
                        {latestScan.method === "watch" ? "Apple Watch" : "Camera PPG"}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.noScanHint}>
                    <Ionicons name="water-outline" size={28} color={colors.mutedForeground} />
                    <Text style={[styles.noScanText, { color: colors.mutedForeground }]}>
                      Tap scan to check your hydration
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Two scan buttons: Camera + Watch */}
            <View style={styles.scanBtnsRow}>
              {/* Camera Scan */}
              <Pressable
                style={({ pressed }) => [
                  styles.scanBtnHalf,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
                onPress={() => handleScan("camera")}
              >
                <Ionicons name="scan-outline" size={20} color={colors.primaryForeground} />
                <Text style={[styles.scanBtnHalfTitle, { color: colors.primaryForeground }]}>
                  Camera Scan
                </Text>
                <Text style={[styles.scanBtnHalfSub, { color: colors.primaryForeground + "bb" }]}>
                  Live PPG reading
                </Text>
              </Pressable>

              {/* Watch Scan */}
              {Platform.OS === "ios" ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.scanBtnHalf,
                    {
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: healthKitEnabled ? colors.primary + "50" : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                  onPress={handleWatchScan}
                >
                  <Ionicons
                    name={healthKitEnabled ? "watch-outline" : "link-outline"}
                    size={20}
                    color={healthKitEnabled ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={[styles.scanBtnHalfTitle, { color: healthKitEnabled ? colors.foreground : colors.mutedForeground }]}>
                    {healthKitEnabled ? "Watch Scan" : "Connect Watch"}
                  </Text>
                  {healthKitEnabled ? (
                    healthLoading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : hasHealthData ? (
                      <Text style={[styles.scanBtnHalfSub, { color: colors.mutedForeground }]}>
                        {[
                          healthSnapshot.heartRate ? `${healthSnapshot.heartRate} RHR` : null,
                          healthSnapshot.hrv ? `${healthSnapshot.hrv}ms HRV` : null,
                        ].filter(Boolean).join(" · ")}
                      </Text>
                    ) : (
                      <Text style={[styles.scanBtnHalfSub, { color: colors.mutedForeground }]}>
                        Resting baseline
                      </Text>
                    )
                  ) : (
                    <Text style={[styles.scanBtnHalfSub, { color: colors.mutedForeground }]}>
                      Apple Health
                    </Text>
                  )}
                </Pressable>
              ) : (
                <View style={[styles.scanBtnHalf, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, opacity: 0.45 }]}>
                  <Ionicons name="watch-outline" size={20} color={colors.mutedForeground} />
                  <Text style={[styles.scanBtnHalfTitle, { color: colors.mutedForeground }]}>Watch Scan</Text>
                  <Text style={[styles.scanBtnHalfSub, { color: colors.mutedForeground }]}>iOS only</Text>
                </View>
              )}
            </View>
          </View>

          {/* Score Comparison card — only shown when both scan types have data */}
          {(() => {
            const lastWatch  = history.find((s) => s.method === "watch");
            const lastCamera = history.find((s) => s.method === "phone" || s.method === "simulation");
            if (!lastWatch || !lastCamera) return null;
            const watchColor  = getScoreColor(lastWatch.score);
            const cameraColor = getScoreColor(lastCamera.score);
            return (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeaderLeft}>
                  <Ionicons name="git-compare-outline" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                    Score Comparison
                  </Text>
                </View>
                <View style={styles.compareRow}>
                  {/* Watch column */}
                  <View style={[styles.compareCol, { borderColor: watchColor + "35", backgroundColor: watchColor + "08" }]}>
                    <View style={styles.compareColHeader}>
                      <Ionicons name="watch-outline" size={13} color={colors.mutedForeground} />
                      <Text style={[styles.compareMethod, { color: colors.mutedForeground }]}>Watch</Text>
                    </View>
                    <Text style={[styles.compareScore, { color: watchColor }]}>{lastWatch.score}</Text>
                    <Text style={[styles.compareLabel, { color: watchColor }]}>{getScoreLabel(lastWatch.score)}</Text>
                    <Text style={[styles.compareSubLabel, { color: colors.mutedForeground }]}>Resting Baseline</Text>
                    <Text style={[styles.compareTime, { color: colors.mutedForeground }]}>{timeAgo(lastWatch.date)}</Text>
                  </View>

                  {/* Divider */}
                  <View style={styles.compareDivider}>
                    <View style={[styles.compareDividerLine, { backgroundColor: colors.border }]} />
                    <Text style={[styles.compareVs, { color: colors.mutedForeground }]}>vs</Text>
                    <View style={[styles.compareDividerLine, { backgroundColor: colors.border }]} />
                  </View>

                  {/* Camera column */}
                  <View style={[styles.compareCol, { borderColor: cameraColor + "35", backgroundColor: cameraColor + "08" }]}>
                    <View style={styles.compareColHeader}>
                      <Ionicons name="flashlight-outline" size={13} color={colors.mutedForeground} />
                      <Text style={[styles.compareMethod, { color: colors.mutedForeground }]}>Camera</Text>
                    </View>
                    <Text style={[styles.compareScore, { color: cameraColor }]}>{lastCamera.score}</Text>
                    <Text style={[styles.compareLabel, { color: cameraColor }]}>{getScoreLabel(lastCamera.score)}</Text>
                    <Text style={[styles.compareSubLabel, { color: colors.mutedForeground }]}>Live Reading</Text>
                    <Text style={[styles.compareTime, { color: colors.mutedForeground }]}>{timeAgo(lastCamera.date)}</Text>
                  </View>
                </View>

                <Text style={[styles.compareFootnote, { color: colors.mutedForeground }]}>
                  A gap between scores is normal — Watch reflects your resting state from earlier; Camera captures your current reading.
                </Text>
              </View>
            );
          })()}


          {history.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                7-Day Trend
              </Text>
              <TrendChart history={history} width={320} height={110} />
            </View>
          )}

          {history.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  Recent Scans
                </Text>
                <Pressable onPress={() => router.push("/(tabs)/history")}>
                  <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
                </Pressable>
              </View>
              {history.slice(0, 3).map((scan) => {
                const c = getScoreColor(scan.score);
                const isWatch = scan.method === "watch";
                return (
                  <View
                    key={scan.id}
                    style={[styles.historyRow, { borderBottomColor: colors.border }]}
                  >
                    <View style={[styles.scoreChip, { backgroundColor: c + "20" }]}>
                      <Text style={[styles.scoreChipText, { color: c }]}>{scan.score}</Text>
                    </View>
                    <View style={styles.historyInfo}>
                      <Text style={[styles.historyLabel, { color: colors.foreground }]}>
                        {getScoreLabel(scan.score)}
                      </Text>
                      <Text style={[styles.historyTime, { color: colors.mutedForeground }]}>
                        {timeAgo(scan.date)} ·{" "}
                        {isWatch ? "Apple Watch" : "Camera PPG"}
                      </Text>
                    </View>
                    <View style={[styles.confidenceBadge, { backgroundColor: colors.muted }]}>
                      <Ionicons
                        name={isWatch ? "watch-outline" : "phone-portrait-outline"}
                        size={12}
                        color={colors.mutedForeground}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {history.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="water-outline" size={48} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No scans yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Run a camera scan or tap "Scan with Watch" to see your hydration score and trends here.
              </Text>
            </View>
          )}
          </Animated.View>
        )}
      </ScrollView>

      <WaterLogModal
        visible={showWaterLog}
        onClose={() => setShowWaterLog(false)}
        onLog={(oz, time) => {
          addWaterLog({ amountOz: oz, time }).catch(() => {});
          writeWaterLog(oz, time).catch(() => {});
        }}
      />

      <DailyFactModal
        visible={dailyFact.visible}
        fact={dailyFact.fact}
        onDismiss={dailyFact.dismiss}
      />

      <StreakCelebration
        streak={celebrationStreak ?? 0}
        visible={celebrationStreak !== null}
        onDismiss={() => setCelebrationStreak(null)}
      />

      <WeeklyReward
        totalDays={totalUniqueDays}
        visible={showWeeklyReward && celebrationStreak === null}
        onDismiss={() => setShowWeeklyReward(false)}
      />

      {/* ── Watch scan overlay: scanning / failed ──────────────────────── */}
      <Modal
        visible={watchPhase !== "idle"}
        transparent
        animationType="fade"
        onRequestClose={() => watchPhase === "failed" && setWatchPhase("idle")}
      >
        <View style={styles.watchOverlay}>
          <View style={[styles.watchSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="watch-outline" size={40} color={colors.primary} />

            {watchPhase !== "failed" ? (
              /* scanning OR idle-fading-out: always show spinner so the
                 modal fade-out animation doesn't briefly flash the error */
              <>
                <Text style={[styles.watchSheetTitle, { color: colors.foreground }]}>
                  Reading Apple Watch
                </Text>
                <Text style={[styles.watchSheetSub, { color: colors.mutedForeground }]}>
                  Fetching resting heart rate and HRV from Health…
                </Text>
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 12 }} />
              </>
            ) : (
              /* failed: show the error and dismiss button */
              <>
                <Text style={[styles.watchSheetTitle, { color: colors.foreground }]}>
                  Scan Unavailable
                </Text>
                <Text style={[styles.watchSheetSub, { color: colors.mutedForeground }]}>
                  {watchError}
                </Text>
                <Pressable
                  style={[styles.watchDismissBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setWatchPhase("idle")}
                >
                  <Text style={styles.watchDismissBtnText}>OK</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  // Today card
  todayCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  todayRow: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 0,
  },
  todayRingCol: {
    alignItems: "center",
    gap: 6,
    width: 90,
  },
  todayRingLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  todayDivider: {
    width: 1,
    height: 72,
    marginHorizontal: 18,
  },
  todayStreakCol: {
    flex: 1,
    gap: 3,
  },
  streakMainRow: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 8,
  },
  streakNumber: {
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
    lineHeight: 48,
  },
  streakUnitTop: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    lineHeight: 19,
  },
  streakUnitBottom: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  bestStreakText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  streakNudge: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
    marginTop: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  greeting: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 2 },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  scoreCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  gaugeRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  gaugeInfo: { flex: 1, gap: 10 },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  statusText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  lastScanTime: { fontSize: 13, fontFamily: "Inter_400Regular" },
  metricMini: { flexDirection: "row", alignItems: "center", gap: 6 },
  metricMiniText: { fontSize: 14, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  methodLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  noScanHint: { alignItems: "center", gap: 8 },
  noScanText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  scanBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  scanBtnsRow: { flexDirection: "row" as const, gap: 10 },
  scanBtnHalf: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 14,
    minHeight: 80,
  },
  scanBtnHalfTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const, textAlign: "center" as const },
  scanBtnHalfSub: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" as const, lineHeight: 15 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  connectedBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  connectedText: { fontSize: 12, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  connectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  connectBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  healthLoadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  healthLoadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  healthMetricsRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  healthMetric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  healthMetricValue: { fontSize: 18, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  healthMetricUnit: { fontSize: 12, fontFamily: "Inter_400Regular" },
  healthUpdated: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, width: "100%" },
  healthEmpty: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  watchScanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 2,
  },
  watchScanBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  seeAll: { fontSize: 14, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  scoreChip: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreChipText: { fontSize: 18, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  historyInfo: { flex: 1, gap: 3 },
  historyLabel: { fontSize: 15, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  historyTime: { fontSize: 12, fontFamily: "Inter_400Regular" },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  emptyState: { alignItems: "center", gap: 12, paddingVertical: 40 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  // Score Comparison card
  compareRow: { flexDirection: "row" as const, alignItems: "stretch", gap: 10 },
  compareCol: {
    flex: 1,
    alignItems: "center" as const,
    gap: 3,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  compareColHeader: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, marginBottom: 4 },
  compareMethod: { fontSize: 11, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const, textTransform: "uppercase" as const, letterSpacing: 0.8 },
  compareScore: { fontSize: 36, fontFamily: "Inter_700Bold", fontWeight: "700" as const, lineHeight: 40 },
  compareLabel: { fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700" as const, textTransform: "uppercase" as const, letterSpacing: 0.8 },
  compareSubLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  compareTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  compareDivider: { alignItems: "center" as const, justifyContent: "center" as const, gap: 4, paddingVertical: 8 },
  compareDividerLine: { width: 1, flex: 1 },
  compareVs: { fontSize: 11, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const, textTransform: "uppercase" as const, letterSpacing: 1 },
  compareFootnote: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, textAlign: "center" as const },
  // Water card
  waterTotal: { fontSize: 14, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  progressTrack: { height: 5, borderRadius: 3, overflow: "hidden", flexDirection: "row" as const },
  logWaterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  logWaterBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  // Water log modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 16,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center" },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  modalSub: { fontSize: 13, fontFamily: "Inter_500Medium", fontWeight: "500" as const, textTransform: "uppercase", letterSpacing: 0.5 },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  amountInput: { flex: 1, fontSize: 28, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  amountUnit: { fontSize: 18, fontFamily: "Inter_400Regular" },
  timePickerWrap: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  modalActions: { flexDirection: "row", gap: 12 },
  cancelBtn: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: "center" },
  cancelBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  logBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    paddingVertical: 14,
  },
  logBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  // Watch scan overlay
  watchOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  watchSheet: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  watchSheetTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
    textAlign: "center",
  },
  watchSheetSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  watchDismissBtn: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  watchDismissBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
});
