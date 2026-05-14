import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TrendChart } from "@/components/TrendChart";
import {
  ScanRecord,
  getScoreColor,
  getScoreLabel,
  useHydration,
} from "@/context/HydrationContext";
import { WorkoutRecord, useWorkout } from "@/context/WorkoutContext";
import { useColors } from "@/hooks/useColors";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(mins: number | null): string {
  if (mins === null) return "—";
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m`;
}

function StatCard({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function ScansTab() {
  const colors = useColors();
  const { history } = useHydration();
  const router = useRouter();

  const totalScans = history.length;
  const avgScore =
    totalScans > 0
      ? (history.reduce((s, r) => s + r.score, 0) / totalScans).toFixed(1)
      : "—";
  const bestScore = totalScans > 0 ? Math.max(...history.map((r) => r.score)) : 0;

  const renderItem = ({ item }: { item: ScanRecord }) => {
    const c = getScoreColor(item.score);
    return (
      <View
        style={[
          styles.scanRow,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={[styles.scoreCircle, { backgroundColor: c + "20", borderColor: c + "40" }]}>
          <Text style={[styles.scoreCircleNum, { color: c }]}>{item.score}</Text>
        </View>
        <View style={styles.scanInfo}>
          <View style={styles.scanInfoTop}>
            <Text style={[styles.scanLabel, { color: colors.foreground }]}>
              {getScoreLabel(item.score)}
            </Text>
            <View style={[styles.methodBadge, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.methodText, { color: colors.mutedForeground }]}>
                {item.method}
              </Text>
            </View>
          </View>
          <Text style={[styles.scanDate, { color: colors.mutedForeground }]}>
            {formatDate(item.date)}
          </Text>
          {item.heartRate && (
            <View style={styles.metricsRow}>
              <Ionicons name="heart" size={12} color={colors.destructive} />
              <Text style={[styles.metricText, { color: colors.mutedForeground }]}>
                {item.heartRate} BPM
              </Text>
              {item.hrv ? (
                <>
                  <Text style={[styles.metricDot, { color: colors.border }]}>·</Text>
                  <Ionicons name="pulse" size={12} color={colors.accent} />
                  <Text style={[styles.metricText, { color: colors.mutedForeground }]}>
                    HRV {item.hrv}
                  </Text>
                </>
              ) : null}
              <Text style={[styles.metricDot, { color: colors.border }]}>·</Text>
              <Text style={[styles.metricText, { color: colors.mutedForeground }]}>
                {item.confidence}% conf.
              </Text>
            </View>
          )}
        </View>
      </View>
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
        style={({ pressed }) => [
          styles.scanNowBtn,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={() => router.push("/scan")}
      >
        <Text style={[styles.scanNowText, { color: colors.primaryForeground }]}>
          Start First Scan
        </Text>
      </Pressable>
    </View>
  );

  return (
    <FlatList
      data={history}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={ListEmpty}
      contentContainerStyle={[styles.listContent]}
      showsVerticalScrollIndicator={false}
      scrollEnabled={!!history.length}
    />
  );
}

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
          <Text style={[styles.workoutTitle, { color: colors.foreground }]}>
            {formatDate(w.startDate)}
          </Text>
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
            {w.sweatLossOz !== null && w.sweatLossOz >= 1
              ? `${w.sweatLossOz.toFixed(1)} oz`
              : w.sweatLossOz !== null && w.sweatLossOz > 0
              ? "< 1 oz"
              : "0 oz"}
          </Text>
          <Text style={[styles.workoutMetricLabel, { color: colors.mutedForeground }]}>
            Sweat Loss
          </Text>
        </View>

        <View style={[styles.workoutMetric, { backgroundColor: colors.muted }]}>
          <Text style={[styles.workoutMetricValue, { color: colors.foreground }]}>
            {w.startWeightLbs} lbs
          </Text>
          <Text style={[styles.workoutMetricLabel, { color: colors.mutedForeground }]}>
            Start Weight
          </Text>
        </View>

        <View style={[styles.workoutMetric, { backgroundColor: colors.muted }]}>
          <Text style={[styles.workoutMetricValue, { color: colors.foreground }]}>
            {w.endWeightLbs?.toFixed(1) ?? "—"} lbs
          </Text>
          <Text style={[styles.workoutMetricLabel, { color: colors.mutedForeground }]}>
            End Weight
          </Text>
        </View>
      </View>

      <View style={styles.workoutHydRow}>
        <View style={styles.hydChange}>
          <View
            style={[
              styles.hydBadge,
              { backgroundColor: scoreColor(w.startHydrationScore) + "20" },
            ]}
          >
            <Text style={[styles.hydBadgeText, { color: scoreColor(w.startHydrationScore) }]}>
              {scoreLabel(w.startHydrationScore)}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={14} color={colors.mutedForeground} />
          <View
            style={[
              styles.hydBadge,
              { backgroundColor: scoreColor(w.endHydrationScore) + "20" },
            ]}
          >
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
        <StatCard
          value={totalSweatOz >= 1 ? `${totalSweatOz.toFixed(1)} oz` : "—"}
          label="Total Sweat"
          color="#0EA5E9"
        />
        <StatCard
          value={avgDuration !== null ? formatDuration(avgDuration) : "—"}
          label="Avg Duration"
          color={colors.accent}
        />
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
        style={({ pressed }) => [
          styles.scanNowBtn,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={() => router.push("/workout")}
      >
        <Text style={[styles.scanNowText, { color: colors.primaryForeground }]}>
          Start Workout
        </Text>
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
      contentContainerStyle={[styles.listContent]}
      showsVerticalScrollIndicator={false}
    />
  );
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"scans" | "workouts">("scans");

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
      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable
          style={[
            styles.tabBtn,
            activeTab === "scans" && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab("scans")}
        >
          <Ionicons
            name="scan-outline"
            size={16}
            color={activeTab === "scans" ? colors.primary : colors.mutedForeground}
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color: activeTab === "scans" ? colors.primary : colors.mutedForeground,
                fontFamily:
                  activeTab === "scans" ? "Inter_600SemiBold" : "Inter_400Regular",
              },
            ]}
          >
            Scans
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabBtn,
            activeTab === "workouts" && {
              borderBottomColor: colors.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab("workouts")}
        >
          <Ionicons
            name="barbell-outline"
            size={16}
            color={activeTab === "workouts" ? colors.primary : colors.mutedForeground}
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color: activeTab === "workouts" ? colors.primary : colors.mutedForeground,
                fontFamily:
                  activeTab === "workouts" ? "Inter_600SemiBold" : "Inter_400Regular",
              },
            ]}
          >
            Sweat Loss
          </Text>
        </Pressable>
      </View>

      <View style={[styles.tabContent, { paddingBottom: insets.bottom + 100 }]}>
        {activeTab === "scans" ? <ScansTab /> : <WorkoutsTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 20,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginRight: 24,
  },
  tabLabel: { fontSize: 15 },
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
  scanRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
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
  methodText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
    textTransform: "capitalize",
  },
  scanDate: { fontSize: 13, fontFamily: "Inter_400Regular" },
  metricsRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metricText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  metricDot: { fontSize: 12 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  scanNowBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  scanNowText: { fontSize: 16, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const },
  workoutRow: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  workoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  workoutTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  workoutTitle: { fontSize: 14, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  durationBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  durationText: { fontSize: 12, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
  workoutMetrics: { flexDirection: "row", gap: 8 },
  workoutMetric: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    gap: 3,
  },
  workoutMetricValue: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
  },
  workoutMetricLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  workoutHydRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hydChange: { flexDirection: "row", alignItems: "center", gap: 8 },
  hydBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  hydBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  hydLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
