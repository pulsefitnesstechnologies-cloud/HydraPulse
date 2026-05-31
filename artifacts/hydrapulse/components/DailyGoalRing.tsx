import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

interface DailyGoalRingProps {
  todayScans: number;
  goalScans?: number;
  size?: number;
}

export function DailyGoalRing({ todayScans, goalScans = 1, size = 88 }: DailyGoalRingProps) {
  const colors = useColors();
  const strokeWidth = 9;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(todayScans / Math.max(goalScans, 1), 1);
  const dashOffset = circumference * (1 - progress);
  const done = todayScans >= goalScans;
  const ringColor = done ? "#10B981" : colors.primary;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Track */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        {progress > 0 && (
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={ringColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${cx}, ${cy}`}
          />
        )}
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.count, { color: done ? "#10B981" : colors.foreground }]}>
          {todayScans}
        </Text>
        <Text style={[styles.goal, { color: colors.mutedForeground }]}>
          of {goalScans}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    gap: 0,
  },
  count: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    lineHeight: 26,
  },
  goal: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 14,
  },
});
