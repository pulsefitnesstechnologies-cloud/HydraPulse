import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TimePicker, TimeValue, formatTime } from "@/components/TimePicker";
import { TrendChart } from "@/components/TrendChart";
import {
  HydrationScore,
  ScanRecord,
  getScoreColor,
  getScoreLabel,
  useHydration,
} from "@/context/HydrationContext";

// ─── Hydration tips by score ───────────────────────────────────────────────────

const SCAN_TIPS: Record<HydrationScore, string[]> = {
  4: [
    "Well-hydrated — keep up your current water intake.",
    "Continue tracking daily to build long-term hydration patterns.",
  ],
  3: [
    "Slightly below optimal — aim for 8–12 fl oz of water in the next hour.",
    "Try spreading your intake evenly throughout the day.",
  ],
  2: [
    "Low hydration detected — drink 16–20 fl oz of water soon.",
    "Reduce caffeine and alcohol, which increase fluid loss.",
    "Set a reminder to drink every 60–90 minutes.",
  ],
  1: [
    "Critical level — drink water immediately and rest.",
    "Avoid strenuous activity until your next scan shows improvement.",
    "If symptoms (dizziness, headache) persist, consult a healthcare professional.",
  ],
};
import { WaterLog, useWaterIntake } from "@/context/WaterIntakeContext";
import { WorkoutRecord, useWorkout } from "@/context/WorkoutContext";
import { useColors } from "@/hooks/useColors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatTimeOnly(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(mins: number | null): string {
  if (mins === null) return "—";
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m`;
}

function nowTimeValue(): TimeValue {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes();
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { hour: h, minute: m, ampm };
}

function StatCard({ value, label, color }: { value: string | number; label: string; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

// ─── Scan Detail Modal ────────────────────────────────────────────────────────

function ScanDetailModal({
  scan,
  onClose,
  onDelete,
}: {
  scan: ScanRecord | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  if (!scan) return null;

  const c = getScoreColor(scan.score);

  return (
    <Modal visible={scan !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View
        style={[
          styles.detailSheet,
          { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 20 },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Score */}
        <View style={styles.detailHeader}>
          <View style={[styles.detailScoreCircle, { backgroundColor: c + "20", borderColor: c + "40" }]}>
            <Text style={[styles.detailScoreNum, { color: c }]}>{scan.score}</Text>
          </View>
          <View style={styles.detailHeaderText}>
            <Text style={[styles.detailLabel, { color: colors.foreground }]}>
              {getScoreLabel(scan.score)}
            </Text>
            <Text style={[styles.detailDate, { color: colors.mutedForeground }]}>
              {formatDate(scan.date)}
            </Text>
          </View>
          <View style={[styles.methodBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.methodText, { color: colors.mutedForeground }]}>{scan.method}</Text>
          </View>
        </View>

        {/* Metrics */}
        <View style={[styles.detailMetrics, { borderColor: colors.border }]}>
          <View style={styles.detailMetricItem}>
            <Ionicons name="heart" size={18} color={colors.destructive} />
            <Text style={[styles.detailMetricVal, { color: colors.foreground }]}>
              {scan.heartRate ?? "—"} BPM
            </Text>
            <Text style={[styles.detailMetricKey, { color: colors.mutedForeground }]}>Heart Rate</Text>
          </View>
          <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />
          <View style={styles.detailMetricItem}>
            <Ionicons name="pulse" size={18} color={colors.accent} />
            <Text style={[styles.detailMetricVal, { color: colors.foreground }]}>
              {scan.hrv ? `${scan.hrv} ms` : "—"}
            </Text>
            <Text style={[styles.detailMetricKey, { color: colors.mutedForeground }]}>HRV</Text>
          </View>
          <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />
          <View style={styles.detailMetricItem}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
            <Text style={[styles.detailMetricVal, { color: colors.foreground }]}>
              {scan.confidence}%
            </Text>
            <Text style={[styles.detailMetricKey, { color: colors.mutedForeground }]}>Confidence</Text>
          </View>
        </View>

        {/* Hydration Tips */}
        <View style={[styles.tipsCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[styles.tipsTitle, { color: colors.mutedForeground }]}>Recommendations</Text>
          {SCAN_TIPS[scan.score].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Ionicons name="water-outline" size={14} color={colors.primary} style={{ marginTop: 2 }} />
              <Text style={[styles.tipText, { color: colors.foreground }]}>{tip}</Text>
            </View>
          ))}
        </View>

        {scan.notes ? (
          <View style={[styles.detailNotes, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.detailNotesText, { color: colors.mutedForeground }]}>{scan.notes}</Text>
          </View>
        ) : null}

        {/* Actions */}
        <View style={styles.detailActions}>
          <Pressable
            style={[styles.detailCloseBtn, { borderColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.detailCloseBtnText, { color: colors.foreground }]}>Close</Text>
          </Pressable>
          <Pressable
            style={[styles.detailDeleteBtn, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "40" }]}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              onDelete(scan.id);
              onClose();
            }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.destructive} />
            <Text style={[styles.detailDeleteBtnText, { color: colors.destructive }]}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Water Log Modal ──────────────────────────────────────────────────────────

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

  const handleLog = () => {
    const oz = parseFloat(amountText);
    if (isNaN(oz) || oz <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount in fluid ounces.");
      return;
    }
    // Build ISO timestamp from today's date + selected time
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
      <Pressable style={styles.overlay} onPress={onClose} />
      <View
        style={[
          styles.detailSheet,
          { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 20 },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <Text style={[styles.logTitle, { color: colors.foreground }]}>Log Water Intake</Text>

        <View style={styles.logRow}>
          <View style={[styles.logInputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <TextInput
              style={[styles.logInput, { color: colors.foreground }]}
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              value={amountText}
              onChangeText={setAmountText}
              returnKeyType="done"
            />
            <Text style={[styles.logUnit, { color: colors.mutedForeground }]}>fl oz</Text>
          </View>
        </View>

        <Text style={[styles.logTimeLabel, { color: colors.mutedForeground }]}>Time Finished Drinking</Text>
        <View style={[styles.pickerWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <TimePicker value={timeVal} onChange={setTimeVal} />
        </View>

        <View style={styles.detailActions}>
          <Pressable
            style={[styles.detailCloseBtn, { borderColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.detailCloseBtnText, { color: colors.foreground }]}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.logBtn, { backgroundColor: colors.primary }]}
            onPress={handleLog}
          >
            <Ionicons name="water" size={16} color={colors.primaryForeground} />
            <Text style={[styles.logBtnText, { color: colors.primaryForeground }]}>Log</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Scans Tab ────────────────────────────────────────────────────────────────

function ScansTab() {
  const colors = useColors();
  const { history, removeScan } = useHydration();
  const router = useRouter();
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null);

  const totalScans = history.length;
  const avgScore =
    totalScans > 0 ? (history.reduce((s, r) => s + r.score, 0) / totalScans).toFixed(1) : "—";
  const bestScore = totalScans > 0 ? Math.max(...history.map((r) => r.score)) : 0;

  const handleDelete = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    removeScan(id);
  };

  const renderRightActions = (item: ScanRecord) => (
    <Pressable
      style={[styles.swipeDelete, { backgroundColor: colors.destructive }]}
      onPress={() => handleDelete(item.id)}
    >
      <Ionicons name="trash-outline" size={20} color="#fff" />
      <Text style={styles.swipeDeleteText}>Delete</Text>
    </Pressable>
  );

  const renderItem = ({ item }: { item: ScanRecord }) => {
    const c = getScoreColor(item.score);
    return (
      <Swipeable renderRightActions={() => renderRightActions(item)} friction={2} overshootRight={false}>
        <Pressable
          style={[styles.scanRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setSelectedScan(item)}
        >
          <View style={[styles.scoreCircle, { backgroundColor: c + "20", borderColor: c + "40" }]}>
            <Text style={[styles.scoreCircleNum, { color: c }]}>{item.score}</Text>
          </View>
          <View style={styles.scanInfo}>
            <View style={styles.scanInfoTop}>
              <Text style={[styles.scanLabel, { color: colors.foreground }]}>{getScoreLabel(item.score)}</Text>
              <View style={[styles.methodBadge, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.methodText, { color: colors.mutedForeground }]}>{item.method}</Text>
              </View>
            </View>
            <Text style={[styles.scanDate, { color: colors.mutedForeground }]}>{formatDate(item.date)}</Text>
            {item.heartRate && (
              <View style={styles.metricsRow}>
                <Ionicons name="heart" size={12} color={colors.destructive} />
                <Text style={[styles.metricText, { color: colors.mutedForeground }]}>{item.heartRate} BPM</Text>
                {item.hrv ? (
                  <>
                    <Text style={[styles.metricDot, { color: colors.border }]}>·</Text>
                    <Ionicons name="pulse" size={12} color={colors.accent} />
                    <Text style={[styles.metricText, { color: colors.mutedForeground }]}>HRV {item.hrv}</Text>
                  </>
                ) : null}
                <Text style={[styles.metricDot, { color: colors.border }]}>·</Text>
                <Text style={[styles.metricText, { color: colors.mutedForeground }]}>{item.confidence}% conf.</Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={14} color={colors.border} style={{ marginLeft: "auto" }} />
        </Pressable>
      </Swipeable>
    );
  };

  const ListHeader = () => (
    <View style={styles.listHeader}>
      <View style={styles.statsRow}>
        <StatCard value={totalScans} label="Total Scans" color={colors.primary} />
        <StatCard value={avgScore} label="Avg Score" color={colors.accent} />
        <StatCard value={bestScore > 0 ? bestScore : "—"} label="Best Score" color="#10B981" />
      </View>
      {history.length > 0 && (
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>7-Day Trend</Text>
          <TrendChart history={history} width={320} height={110} />
        </View>
      )}
      <Text style={[styles.listTitle, { color: colors.foreground }]}>All Scans</Text>
      {history.length > 0 && (
        <Text style={[styles.swipeHint, { color: colors.mutedForeground }]}>
          Swipe left to delete · Tap to view details
        </Text>
      )}
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.empty}>
      <Ionicons name="bar-chart-outline" size={48} color={colors.border} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No history yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        Your scan history will appear here.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.scanNowBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        onPress={() => router.push("/scan")}
      >
        <Text style={[styles.scanNowText, { color: colors.primaryForeground }]}>Start First Scan</Text>
      </Pressable>
    </View>
  );

  return (
    <>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!history.length}
      />
      <ScanDetailModal
        scan={selectedScan}
        onClose={() => setSelectedScan(null)}
        onDelete={handleDelete}
      />
    </>
  );
}

// ─── Water Tab ────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function formatNavDate(d: Date): string {
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function WaterTab() {
  const colors = useColors();
  const { waterLog, addWaterLog, deleteWaterLog } = useWaterIntake();
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));

  const today = startOfDay(new Date());
  const isToday = selectedDate.getTime() === today.getTime();

  const goBack = () =>
    setSelectedDate((d) => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() - 1);
      return nd;
    });

  const goForward = () => {
    if (isToday) return;
    setSelectedDate((d) => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() + 1);
      return nd;
    });
  };

  // Logs for the selected calendar day
  const dayStart = selectedDate;
  const dayEnd = endOfDay(selectedDate);
  const dayLogs = waterLog.filter((e) => {
    const t = new Date(e.time);
    return t >= dayStart && t <= dayEnd;
  });
  const dayTotalOz = dayLogs.reduce((s, e) => s + e.amountOz, 0);

  // All-time stats
  const allTotalOz = waterLog.reduce((s, e) => s + e.amountOz, 0);
  const avgPerEntry = waterLog.length > 0 ? allTotalOz / waterLog.length : 0;

  const handleLog = async (oz: number, time: string) => {
    await addWaterLog({ amountOz: oz, time });
  };

  const renderRightActions = (item: WaterLog) => (
    <Pressable
      style={[styles.swipeDelete, { backgroundColor: colors.destructive }]}
      onPress={() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        deleteWaterLog(item.id);
      }}
    >
      <Ionicons name="trash-outline" size={20} color="#fff" />
      <Text style={styles.swipeDeleteText}>Delete</Text>
    </Pressable>
  );

  const renderItem = ({ item }: { item: WaterLog }) => (
    <Swipeable renderRightActions={() => renderRightActions(item)} friction={2} overshootRight={false}>
      <View style={[styles.waterRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.waterIcon, { backgroundColor: "#0EA5E9" + "20" }]}>
          <Ionicons name="water" size={18} color="#0EA5E9" />
        </View>
        <View style={styles.waterInfo}>
          <Text style={[styles.waterAmount, { color: colors.foreground }]}>
            {item.amountOz % 1 === 0 ? item.amountOz : item.amountOz.toFixed(1)} fl oz
          </Text>
          <Text style={[styles.waterTime, { color: colors.mutedForeground }]}>
            {formatTimeOnly(item.time)}
          </Text>
        </View>
      </View>
    </Swipeable>
  );

  const ListHeader = () => (
    <View style={styles.listHeader}>
      {/* All-time stats */}
      <View style={styles.statsRow}>
        <StatCard
          value={dayTotalOz >= 1 ? `${dayTotalOz % 1 === 0 ? dayTotalOz : dayTotalOz.toFixed(1)} oz` : "0 oz"}
          label={isToday ? "Today" : "Day Total"}
          color="#0EA5E9"
        />
        <StatCard value={waterLog.length} label="Total Logs" color={colors.primary} />
        <StatCard
          value={avgPerEntry > 0 ? `${avgPerEntry.toFixed(1)} oz` : "—"}
          label="Avg Entry"
          color={colors.accent}
        />
      </View>

      {/* Log button */}
      <Pressable
        style={({ pressed }) => [
          styles.logWaterBtn,
          { backgroundColor: "#0EA5E9", opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={() => setShowLogModal(true)}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.logWaterBtnText}>Log Water Intake</Text>
      </Pressable>

      {/* Date navigation */}
      <View style={[styles.dateNav, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable style={styles.dateNavBtn} onPress={goBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={[styles.dateNavLabel, { color: colors.foreground }]}>
          {formatNavDate(selectedDate)}
        </Text>
        <Pressable
          style={[styles.dateNavBtn, isToday && { opacity: 0.25 }]}
          onPress={goForward}
          disabled={isToday}
          hitSlop={12}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {dayLogs.length > 0 && (
        <Text style={[styles.swipeHint, { color: colors.mutedForeground }]}>Swipe left to delete</Text>
      )}
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.empty}>
      <Ionicons name="water-outline" size={48} color={colors.border} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        No entries for {formatNavDate(selectedDate).toLowerCase()}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        {isToday
          ? "Tap Log Water Intake to start tracking today's hydration."
          : "No water was logged on this day."}
      </Text>
    </View>
  );

  return (
    <>
      <FlatList
        data={dayLogs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      <WaterLogModal
        visible={showLogModal}
        onClose={() => setShowLogModal(false)}
        onLog={handleLog}
      />
    </>
  );
}

// ─── Workouts Tab ─────────────────────────────────────────────────────────────

function WorkoutsTab() {
  const colors = useColors();
  const { workouts } = useWorkout();
  const router = useRouter();
  const finished = workouts.filter((w) => w.endDate !== null);

  const totalSweatOz = finished.reduce((s, w) => s + (w.sweatLossOz ?? 0), 0);
  const avgDuration =
    finished.length > 0
      ? Math.round(finished.reduce((s, w) => s + (w.durationMinutes ?? 0), 0) / finished.length)
      : null;

  const scoreLabel = (s: number | null) => {
    if (s === null) return "—";
    return ["", "Critical", "Low", "Good", "Excellent"][s] ?? "—";
  };
  const scoreColor = (s: number | null) => {
    if (s === null) return colors.mutedForeground;
    return ["", "#EF4444", "#F97316", "#0EA5E9", "#10B981"][s] ?? colors.mutedForeground;
  };

  const renderItem = ({ item: w }: { item: WorkoutRecord }) => (
    <View style={[styles.workoutRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.workoutHeader}>
        <View style={styles.workoutTitleRow}>
          <Ionicons name="barbell-outline" size={16} color={colors.primary} />
          <Text style={[styles.workoutTitle, { color: colors.foreground }]}>{formatDate(w.startDate)}</Text>
        </View>
        <View style={[styles.durationBadge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.durationText, { color: colors.mutedForeground }]}>
            {formatDuration(w.durationMinutes)}
          </Text>
        </View>
      </View>
      <View style={styles.workoutMetrics}>
        <View style={[styles.workoutMetric, { backgroundColor: "#0EA5E9" + "15" }]}>
          <Text style={[styles.workoutMetricValue, { color: "#0EA5E9" }]}>
            {w.sweatLossOz !== null && w.sweatLossOz >= 1 ? `${w.sweatLossOz.toFixed(1)} oz` : w.sweatLossOz !== null && w.sweatLossOz > 0 ? "< 1 oz" : "0 oz"}
          </Text>
          <Text style={[styles.workoutMetricLabel, { color: colors.mutedForeground }]}>Sweat Loss</Text>
        </View>
        <View style={[styles.workoutMetric, { backgroundColor: colors.muted }]}>
          <Text style={[styles.workoutMetricValue, { color: colors.foreground }]}>{w.startWeightLbs} lbs</Text>
          <Text style={[styles.workoutMetricLabel, { color: colors.mutedForeground }]}>Start Weight</Text>
        </View>
        <View style={[styles.workoutMetric, { backgroundColor: colors.muted }]}>
          <Text style={[styles.workoutMetricValue, { color: colors.foreground }]}>{w.endWeightLbs?.toFixed(1) ?? "—"} lbs</Text>
          <Text style={[styles.workoutMetricLabel, { color: colors.mutedForeground }]}>End Weight</Text>
        </View>
      </View>
      <View style={styles.workoutHydRow}>
        <View style={styles.hydChange}>
          <View style={[styles.hydBadge, { backgroundColor: scoreColor(w.startHydrationScore) + "20" }]}>
            <Text style={[styles.hydBadgeText, { color: scoreColor(w.startHydrationScore) }]}>
              {scoreLabel(w.startHydrationScore)}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={14} color={colors.mutedForeground} />
          <View style={[styles.hydBadge, { backgroundColor: scoreColor(w.endHydrationScore) + "20" }]}>
            <Text style={[styles.hydBadgeText, { color: scoreColor(w.endHydrationScore) }]}>
              {scoreLabel(w.endHydrationScore)}
            </Text>
          </View>
        </View>
        <Text style={[styles.hydLabel, { color: colors.mutedForeground }]}>Hydration</Text>
      </View>
    </View>
  );

  const ListHeader = () => (
    <View style={styles.listHeader}>
      <View style={styles.statsRow}>
        <StatCard value={finished.length} label="Workouts" color={colors.primary} />
        <StatCard value={totalSweatOz >= 1 ? `${totalSweatOz.toFixed(1)} oz` : "—"} label="Total Sweat" color="#0EA5E9" />
        <StatCard value={avgDuration !== null ? formatDuration(avgDuration) : "—"} label="Avg Duration" color={colors.accent} />
      </View>
      <Text style={[styles.listTitle, { color: colors.foreground }]}>Sweat Loss Log</Text>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.empty}>
      <Ionicons name="barbell-outline" size={48} color={colors.border} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No workouts yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        Start a workout on the home screen to track your sweat loss and hydration changes.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.scanNowBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        onPress={() => router.push("/workout")}
      >
        <Text style={[styles.scanNowText, { color: colors.primaryForeground }]}>Start Workout</Text>
      </Pressable>
    </View>
  );

  return (
    <FlatList
      data={finished}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={ListEmpty}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"scans" | "water" | "workouts">("scans");

  const tabs: Array<{ id: "scans" | "water" | "workouts"; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { id: "scans", label: "Scans", icon: "scan-outline" },
    { id: "water", label: "Water", icon: "water-outline" },
    { id: "workouts", label: "Sweat Loss", icon: "barbell-outline" },
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? insets.top + 67 : 0 },
      ]}
    >
      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={[
              styles.tabBtn,
              activeTab === tab.id && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.id ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.tabLabel,
                {
                  color: activeTab === tab.id ? colors.primary : colors.mutedForeground,
                  fontFamily: activeTab === tab.id ? "Inter_600SemiBold" : "Inter_400Regular",
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.tabContent, { paddingBottom: insets.bottom + 100 }]}>
        {activeTab === "scans" ? <ScansTab /> : activeTab === "water" ? <WaterTab /> : <WorkoutsTab />}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 16 },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginRight: 18,
  },
  tabLabel: { fontSize: 14 },
  tabContent: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  listHeader: { gap: 16, marginBottom: 8 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  chartCard: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 12 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  listTitle: { fontSize: 20, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  swipeHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -8 },
  scanRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    backgroundColor: "transparent",
  },
  scoreCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreCircleNum: { fontSize: 20, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  scanInfo: { flex: 1, gap: 4 },
  scanInfoTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  scanLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  methodBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  methodText: { fontSize: 11, fontFamily: "Inter_500Medium", fontWeight: "500" as const, textTransform: "capitalize" },
  scanDate: { fontSize: 13, fontFamily: "Inter_400Regular" },
  metricsRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metricText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  metricDot: { fontSize: 12 },
  swipeDelete: {
    width: 80,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    marginLeft: 6,
  },
  swipeDeleteText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
  scanNowBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  scanNowText: { fontSize: 16, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  // Water tab
  waterRow: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, borderWidth: 1, padding: 14 },
  waterIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  waterInfo: { flex: 1, gap: 3 },
  waterAmount: { fontSize: 17, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  waterTime: { fontSize: 13, fontFamily: "Inter_400Regular" },
  logWaterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  logWaterBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  // Workout tab
  workoutRow: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  workoutHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  workoutTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  workoutTitle: { fontSize: 14, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  durationBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  durationText: { fontSize: 12, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  workoutMetrics: { flexDirection: "row", gap: 8 },
  workoutMetric: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center", gap: 3 },
  workoutMetricValue: { fontSize: 15, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  workoutMetricLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.3 },
  workoutHydRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hydChange: { flexDirection: "row", alignItems: "center", gap: 8 },
  hydBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  hydBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  hydLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  // Detail modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  detailSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center" },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 14 },
  detailScoreCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  detailScoreNum: { fontSize: 26, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  detailHeaderText: { flex: 1, gap: 3 },
  detailLabel: { fontSize: 20, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  detailDate: { fontSize: 13, fontFamily: "Inter_400Regular" },
  detailMetrics: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
  },
  detailMetricItem: { flex: 1, alignItems: "center", gap: 4 },
  detailDivider: { width: 1, marginVertical: 4 },
  detailMetricVal: { fontSize: 17, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  detailMetricKey: { fontSize: 11, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5 },
  detailNotes: { borderRadius: 12, borderWidth: 1, padding: 12 },
  detailNotesText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  detailActions: { flexDirection: "row", gap: 12 },
  detailCloseBtn: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: "center" },
  detailCloseBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  detailDeleteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
  },
  detailDeleteBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  // Date navigation
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  dateNavBtn: { padding: 4 },
  dateNavLabel: { fontSize: 17, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  // Tips card
  tipsCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  tipsTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tipText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  // Water log modal
  logTitle: { fontSize: 20, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  logRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  logInput: { flex: 1, fontSize: 24, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  logUnit: { fontSize: 16, fontFamily: "Inter_400Regular" },
  logTimeLabel: { fontSize: 13, fontFamily: "Inter_500Medium", fontWeight: "500" as const, textTransform: "uppercase", letterSpacing: 0.5 },
  pickerWrap: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  logBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    paddingVertical: 14,
  },
  logBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
});
