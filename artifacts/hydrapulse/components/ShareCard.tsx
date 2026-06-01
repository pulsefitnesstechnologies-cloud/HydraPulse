import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { HydrationScore, ScanRecord, getScoreColor, getScoreLabel } from "@/context/HydrationContext";

interface Props {
  scan: ScanRecord;
  hideMetrics: boolean;
}

const SCORE_NUM_COLOR: Record<HydrationScore, string> = {
  1: "#EF4444",
  2: "#F97316",
  3: "#10B981",
  4: "#38BDF8",
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) + " · " + d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ShareCard({ scan, hideMetrics }: Props) {
  const scoreColor = getScoreColor(scan.score);
  const scoreLabel = getScoreLabel(scan.score);
  const displayHR = scan.method === "watch"
    ? (scan.heartRate ?? scan.liveHeartRate)
    : (scan.liveHeartRate ?? scan.heartRate);
  const hrLabel = scan.method === "watch" ? "RHR" : "BPM";
  const methodLabel = scan.method === "watch" ? "Watch" : "Camera";

  return (
    <View style={styles.card}>
      {/* Accent bar */}
      <View style={[styles.accentBar, { backgroundColor: scoreColor }]} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>HYDRAPULSE</Text>
        <View style={[styles.methodBadge, { borderColor: scoreColor + "60" }]}>
          <Text style={[styles.methodBadgeText, { color: scoreColor }]}>
            {methodLabel}
          </Text>
        </View>
      </View>

      {/* Score */}
      <View style={styles.scoreBlock}>
        <Text style={[styles.scoreNumber, { color: SCORE_NUM_COLOR[scan.score] }]}>
          {scan.score}
        </Text>
        <Text style={styles.scoreMax}>/4</Text>
      </View>

      {/* Label badge */}
      <View style={[styles.labelBadge, { backgroundColor: scoreColor + "22", borderColor: scoreColor + "50" }]}>
        <Text style={[styles.labelText, { color: scoreColor }]}>
          {scoreLabel.toUpperCase()}
        </Text>
      </View>

      {/* Metrics */}
      <View style={styles.metricsRow}>
        {displayHR ? (
          <View style={styles.metric}>
            <Text style={styles.metricVal}>
              {hideMetrics ? "---" : String(displayHR)}
            </Text>
            <Text style={styles.metricUnit}>{hrLabel}</Text>
          </View>
        ) : null}
        {scan.hrv ? (
          <View style={styles.metric}>
            <Text style={styles.metricVal}>
              {hideMetrics ? "---" : String(scan.hrv)}
            </Text>
            <Text style={styles.metricUnit}>HRV</Text>
          </View>
        ) : null}
        <View style={styles.metric}>
          <Text style={styles.metricVal}>
            {hideMetrics ? "---" : `${scan.confidence}%`}
          </Text>
          <Text style={styles.metricUnit}>Confidence</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.timestamp}>{formatDate(scan.date)}</Text>
        <Text style={styles.disclaimer}>
          HydraPulse · PPG estimate · Not medical advice
        </Text>
      </View>
    </View>
  );
}

const CARD_BG = "#0F1A2E";
const MUTED = "#4A6080";
const FOREGROUND = "#E2EAF4";

const styles = StyleSheet.create({
  card: {
    width: 340,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    overflow: "hidden",
    paddingBottom: 20,
  },
  accentBar: {
    height: 4,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 4,
  },
  brand: {
    fontSize: 12,
    letterSpacing: 3,
    color: "#38BDF8",
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
  },
  methodBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  methodBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  scoreBlock: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    marginTop: 20,
    gap: 4,
  },
  scoreNumber: {
    fontSize: 96,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    lineHeight: 96,
  },
  scoreMax: {
    fontSize: 28,
    color: MUTED,
    fontFamily: "Inter_500Medium",
    fontWeight: "500",
    marginBottom: 14,
  },
  labelBadge: {
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 10,
  },
  labelText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    letterSpacing: 2,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginTop: 22,
    paddingHorizontal: 20,
  },
  metric: {
    alignItems: "center",
    gap: 3,
  },
  metricVal: {
    fontSize: 22,
    color: FOREGROUND,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
  },
  metricUnit: {
    fontSize: 10,
    color: MUTED,
    fontFamily: "Inter_500Medium",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  divider: {
    height: 1,
    backgroundColor: "#1E3A5F",
    marginHorizontal: 20,
    marginTop: 22,
    marginBottom: 14,
  },
  footer: {
    paddingHorizontal: 20,
    gap: 4,
  },
  timestamp: {
    fontSize: 12,
    color: MUTED,
    fontFamily: "Inter_400Regular",
  },
  disclaimer: {
    fontSize: 10,
    color: MUTED,
    fontFamily: "Inter_400Regular",
    opacity: 0.7,
  },
});
