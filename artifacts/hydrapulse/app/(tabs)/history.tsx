import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TrendChart } from "@/components/TrendChart";
import {
  HydrationScore,
  ScanRecord,
  getScoreColor,
  getScoreLabel,
  useHydration,
} from "@/context/HydrationContext";
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

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
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
            <View
              style={[
                styles.methodBadge,
                { backgroundColor: colors.secondary },
              ]}
            >
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
        <StatCard
          value={bestScore > 0 ? bestScore : "—"}
          label="Best Score"
          color="#10B981"
        />
      </View>

      {history.length > 0 && (
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            7-Day Trend
          </Text>
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
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === "web" ? insets.top + 67 : 0,
        },
      ]}
    >
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom:
              insets.bottom + 100 + (Platform.OS === "web" ? 34 : 0),
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!history.length}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  statValue: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  chartCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  listTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
  },
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
  scoreCircleNum: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
  },
  scanInfo: { flex: 1, gap: 4 },
  scanInfoTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scanLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  methodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  methodText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
    textTransform: "capitalize",
  },
  scanDate: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metricText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  metricDot: {
    fontSize: 12,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  scanNowBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  scanNowText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600" as const,
  },
});
