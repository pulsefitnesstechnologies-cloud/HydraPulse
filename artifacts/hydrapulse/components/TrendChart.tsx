import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Polyline, Stop } from "react-native-svg";

import { ScanRecord, getScoreColor } from "@/context/HydrationContext";
import { useColors } from "@/hooks/useColors";

interface TrendChartProps {
  history: ScanRecord[];
  width?: number;
  height?: number;
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][d.getDay()];
}

export function TrendChart({ history, width = 320, height = 120 }: TrendChartProps) {
  const colors = useColors();
  const days = getLast7Days();
  const paddingH = 16;
  const paddingV = 16;
  const chartW = width - paddingH * 2;
  const chartH = height - paddingV * 2;

  const dataByDay: Record<string, number> = {};
  history.forEach((r) => {
    const day = r.date.split("T")[0];
    if (!dataByDay[day] || r.score > dataByDay[day]) {
      dataByDay[day] = r.score;
    }
  });

  const points = days.map((day, i) => {
    const score = dataByDay[day] ?? null;
    const x = paddingH + (i / 6) * chartW;
    const y = score !== null
      ? paddingV + chartH - ((score - 1) / 3) * chartH
      : null;
    return { x, y, score, day };
  });

  const filledPoints = points.filter((p) => p.y !== null) as { x: number; y: number; score: number; day: string }[];

  let polylinePoints = "";
  let areaPath = "";
  if (filledPoints.length > 0) {
    polylinePoints = filledPoints.map((p) => `${p.x},${p.y}`).join(" ");
    const first = filledPoints[0];
    const last = filledPoints[filledPoints.length - 1];
    areaPath = `M${first.x},${paddingV + chartH} ` +
      filledPoints.map((p) => `L${p.x},${p.y}`).join(" ") +
      ` L${last.x},${paddingV + chartH} Z`;
  }

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {areaPath ? (
          <Path d={areaPath} fill="url(#areaGrad)" />
        ) : null}

        {filledPoints.length > 1 ? (
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {filledPoints.map((p) => (
          <Circle
            key={p.day}
            cx={p.x}
            cy={p.y}
            r={5}
            fill={getScoreColor(p.score as 1 | 2 | 3 | 4)}
            stroke={colors.card}
            strokeWidth={2}
          />
        ))}

        {points.filter((p) => p.y === null).map((p, i) => (
          <Circle
            key={`empty-${i}`}
            cx={p.x}
            cy={paddingV + chartH / 2}
            r={3}
            fill={colors.border}
          />
        ))}
      </Svg>

      <View style={[styles.labels, { paddingHorizontal: paddingH - 4 }]}>
        {days.map((day) => (
          <Text
            key={day}
            style={[styles.dayLabel, { color: colors.mutedForeground }]}
          >
            {getDayLabel(day)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
  dayLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
    textAlign: "center",
    width: 24,
  },
});
