import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScoreGauge } from "@/components/ScoreGauge";
import { TrendChart } from "@/components/TrendChart";
import { useHealth } from "@/context/HealthContext";
import {
  getScoreColor,
  getScoreLabel,
  useHydration,
} from "@/context/HydrationContext";
import { useColors } from "@/hooks/useColors";

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

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { latestScan, history } = useHydration();
  const {
    healthKitEnabled,
    healthSnapshot,
    healthLoading,
    connectHealthKit,
    runWatchScan,
  } = useHealth();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [watchScanning, setWatchScanning] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const scoreColor = latestScan ? getScoreColor(latestScan.score) : colors.primary;

  const handleScan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push("/scan");
  };

  const handleConnectHealth = async () => {
    await connectHealthKit();
  };

  const handleWatchScan = async () => {
    if (watchScanning) return;
    setWatchScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const record = await runWatchScan();
      if (record) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        Alert.alert(
          "No Watch Data",
          "No heart rate or HRV data was found in the past 24 hours. Make sure your Apple Watch is worn and syncing.",
          [{ text: "OK" }]
        );
      }
    } finally {
      setWatchScanning(false);
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

        <Animated.View style={{ opacity: fadeAnim, gap: 16 }}>
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

            {/* Camera scan button */}
            <Pressable
              style={({ pressed }) => [
                styles.scanBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleScan}
            >
              <Ionicons name="scan-outline" size={20} color={colors.primaryForeground} />
              <Text style={[styles.scanBtnText, { color: colors.primaryForeground }]}>
                {latestScan ? "Scan Again" : "Start Camera Scan"}
              </Text>
            </Pressable>
          </View>

          {/* Apple Health / Watch card */}
          {Platform.OS === "ios" && (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <Ionicons name="watch-outline" size={16} color={colors.primary} />
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                    Apple Watch
                  </Text>
                </View>
                {healthKitEnabled && (
                  <View style={[styles.connectedBadge, { backgroundColor: "#10B981" + "20" }]}>
                    <Text style={[styles.connectedText, { color: "#10B981" }]}>Connected</Text>
                  </View>
                )}
              </View>

              {!healthKitEnabled ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.connectBtn,
                    {
                      backgroundColor: colors.primary + "15",
                      borderColor: colors.primary + "40",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  onPress={handleConnectHealth}
                >
                  <Ionicons name="link-outline" size={16} color={colors.primary} />
                  <Text style={[styles.connectBtnText, { color: colors.primary }]}>
                    Connect Apple Health
                  </Text>
                </Pressable>
              ) : (
                <>
                  {healthLoading ? (
                    <View style={styles.healthLoadingRow}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.healthLoadingText, { color: colors.mutedForeground }]}>
                        Reading from Apple Watch...
                      </Text>
                    </View>
                  ) : hasHealthData ? (
                    <View style={styles.healthMetricsRow}>
                      {healthSnapshot.heartRate !== null && (
                        <View style={[styles.healthMetric, { backgroundColor: colors.muted }]}>
                          <Ionicons name="heart" size={18} color={colors.destructive} />
                          <Text style={[styles.healthMetricValue, { color: colors.foreground }]}>
                            {healthSnapshot.heartRate}
                          </Text>
                          <Text style={[styles.healthMetricUnit, { color: colors.mutedForeground }]}>
                            BPM
                          </Text>
                        </View>
                      )}
                      {healthSnapshot.hrv !== null && (
                        <View style={[styles.healthMetric, { backgroundColor: colors.muted }]}>
                          <Ionicons name="pulse" size={18} color={colors.accent} />
                          <Text style={[styles.healthMetricValue, { color: colors.foreground }]}>
                            {healthSnapshot.hrv}
                          </Text>
                          <Text style={[styles.healthMetricUnit, { color: colors.mutedForeground }]}>
                            HRV ms
                          </Text>
                        </View>
                      )}
                      {healthSnapshot.lastUpdated && (
                        <Text style={[styles.healthUpdated, { color: colors.mutedForeground }]}>
                          {timeAgo(healthSnapshot.lastUpdated)}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={[styles.healthEmpty, { color: colors.mutedForeground }]}>
                      No heart rate data in the last 24 hours. Wear your Apple Watch to collect readings.
                    </Text>
                  )}

                  {/* Watch scan button */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.watchScanBtn,
                      {
                        backgroundColor: colors.primary + "15",
                        borderColor: colors.primary + "40",
                        opacity: pressed || watchScanning ? 0.7 : 1,
                      },
                    ]}
                    onPress={handleWatchScan}
                    disabled={watchScanning}
                  >
                    {watchScanning ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="watch-outline" size={16} color={colors.primary} />
                    )}
                    <Text style={[styles.watchScanBtnText, { color: colors.primary }]}>
                      {watchScanning ? "Reading Watch Data..." : "Scan with Watch"}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  greeting: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 2 },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  scoreCard: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 16 },
  card: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 14 },
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
});
