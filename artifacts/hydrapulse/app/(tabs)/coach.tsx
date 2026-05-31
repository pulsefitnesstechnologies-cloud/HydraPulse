export { ErrorBoundary } from "@/components/ErrorBoundary";

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHydration } from "@/context/HydrationContext";
import { useWaterIntake } from "@/context/WaterIntakeContext";
import { getTodaysFact } from "@/data/waterFacts";
import { useCoach, TipCategory } from "@/hooks/useCoach";
import { useColors } from "@/hooks/useColors";

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<TipCategory, keyof typeof Ionicons.glyphMap> = {
  Insight:  "analytics-outline",
  Goal:     "trophy-outline",
  Science:  "flask-outline",
  Habit:    "leaf-outline",
  Progress: "trending-up-outline",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  delta,
  icon,
}: {
  label: string;
  value: string;
  delta?: string | null;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const colors = useColors();
  const positive = delta?.startsWith("+");
  const negative = delta?.startsWith("-");
  const deltaColor = positive ? colors.accent : negative ? colors.destructive : colors.mutedForeground;

  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: colors.primary + "15" }]}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {delta ? (
        <Text style={[styles.statDelta, { color: deltaColor }]}>{delta}</Text>
      ) : null}
    </View>
  );
}

function TipRow({
  date,
  category,
  title,
  body,
  isToday,
}: {
  date: string;
  category: TipCategory;
  title: string;
  body: string;
  isToday?: boolean;
}) {
  const colors = useColors();
  const icon = CATEGORY_ICON[category];

  const displayDate = isToday
    ? "Today"
    : (() => {
        const d = new Date(date + "T12:00:00");
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
        return d.toLocaleDateString([], { month: "short", day: "numeric" });
      })();

  return (
    <View
      style={[
        styles.tipRow,
        {
          backgroundColor: isToday ? colors.primary + "08" : colors.card,
          borderColor: isToday ? colors.primary + "40" : colors.border,
        },
      ]}
    >
      <View style={styles.tipRowLeft}>
        <View
          style={[
            styles.tipIconWrap,
            { backgroundColor: isToday ? colors.primary + "20" : colors.muted },
          ]}
        >
          <Ionicons
            name={icon}
            size={15}
            color={isToday ? colors.primary : colors.mutedForeground}
          />
        </View>
        <View style={styles.tipRowContent}>
          <View style={styles.tipRowHeader}>
            <Text
              style={[
                styles.tipTitle,
                { color: isToday ? colors.foreground : colors.foreground },
              ]}
            >
              {title}
            </Text>
            <View
              style={[
                styles.categoryBadge,
                { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" },
              ]}
            >
              <Text style={[styles.categoryText, { color: colors.primary }]}>
                {category}
              </Text>
            </View>
          </View>
          <Text style={[styles.tipBody, { color: colors.mutedForeground }]} numberOfLines={isToday ? undefined : 2}>
            {body}
          </Text>
          <Text style={[styles.tipDate, { color: colors.mutedForeground + "80" }]}>
            {displayDate}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CoachScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { history } = useHydration();
  const { waterLog } = useWaterIntake();
  const { todaysTip, tipHistory, progress, isLoading } = useCoach({ history, waterLog });
  const todaysFact = getTodaysFact();

  const pastTips = tipHistory.filter((t) => t.date !== todaysTip?.date);

  const formatScore = (s: number | null) => (s !== null ? s.toFixed(1) : "—");
  const formatHrv = (h: number | null) => (h !== null ? `${Math.round(h)} ms` : "—");
  const scoreDeltaStr =
    progress.scoreDelta !== null
      ? `${progress.scoreDelta >= 0 ? "+" : ""}${progress.scoreDelta.toFixed(1)} vs last week`
      : null;
  const hrvDeltaStr =
    progress.hrvDelta !== null
      ? `${progress.hrvDelta >= 0 ? "+" : ""}${Math.round(progress.hrvDelta)} ms vs last week`
      : null;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? insets.top + 67 : 0 },
      ]}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header card */}
        <View style={[styles.headerCard, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "25" }]}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + "20" }]}>
            <Ionicons name="bulb-outline" size={26} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              Hydration Coach
            </Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              Personalized insights based on your scan history and water logs
            </Text>
          </View>
        </View>

        {/* Today's Tip */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>TODAY'S INSIGHT</Text>

        {isLoading ? (
          <View style={[styles.loadingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Analyzing your data...
            </Text>
          </View>
        ) : todaysTip ? (
          <TipRow
            date={todaysTip.date}
            category={todaysTip.category}
            title={todaysTip.title}
            body={todaysTip.body}
            isToday
          />
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="scan-outline" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No data yet</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Complete a scan or log some water to get your first personalized insight.
            </Text>
          </View>
        )}

        {/* Today's Fact */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>TODAY'S FACT</Text>
        <View style={[styles.factCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.factIconWrap, { backgroundColor: colors.accent + "15" }]}>
            <Ionicons name="flask-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.factBody}>
            <Text style={[styles.factCategory, { color: colors.accent }]}>
              {todaysFact.category}
            </Text>
            <Text style={[styles.factText, { color: colors.foreground }]}>
              {todaysFact.fact}
            </Text>
          </View>
        </View>

        {/* Progress This Week */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          YOUR WEEK
        </Text>
        <View style={styles.statsGrid}>
          <StatCard
            label="Avg Score"
            value={formatScore(progress.avgScoreThisWeek)}
            delta={scoreDeltaStr}
            icon="water-outline"
          />
          <StatCard
            label="Avg HRV"
            value={formatHrv(progress.avgHrvThisWeek)}
            delta={hrvDeltaStr}
            icon="pulse-outline"
          />
          <StatCard
            label="Scans"
            value={String(progress.scansThisWeek)}
            icon="scan-outline"
          />
          <StatCard
            label="Scan Streak"
            value={progress.currentStreak > 0 ? `${progress.currentStreak}d` : "—"}
            icon="flame-outline"
          />
          <StatCard
            label="Water Logs"
            value={String(progress.waterLogsThisWeek)}
            icon="list-outline"
          />
          <StatCard
            label="Best Score"
            value={progress.bestScoreThisWeek !== null ? `${progress.bestScoreThisWeek}/4` : "—"}
            icon="trophy-outline"
          />
        </View>

        {/* Past Tips */}
        {pastTips.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              PAST INSIGHTS
            </Text>
            <View style={styles.tipList}>
              {pastTips.map((tip) => (
                <TipRow
                  key={tip.date}
                  date={tip.date}
                  category={tip.category}
                  title={tip.title}
                  body={tip.body}
                />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 4,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, gap: 3 },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", fontWeight: "700" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 4,
    marginTop: 6,
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", fontWeight: "600" },
  emptyBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, textAlign: "center" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "31%",
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    alignItems: "flex-start",
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold", fontWeight: "700" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statDelta: { fontSize: 10, fontFamily: "Inter_500Medium", fontWeight: "500", marginTop: 1 },
  factCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "flex-start",
  },
  factIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  factBody: { flex: 1, gap: 4 },
  factCategory: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  factText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  tipList: { gap: 8 },
  tipRow: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  tipRowLeft: { flexDirection: "row", gap: 12 },
  tipIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  tipRowContent: { flex: 1, gap: 5 },
  tipRowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  tipTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", fontWeight: "600" },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryText: { fontSize: 10, fontFamily: "Inter_500Medium", fontWeight: "500" },
  tipBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  tipDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});
