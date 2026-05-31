import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

import { HydrationScore, getScoreColor, getScoreLabel } from "@/context/HydrationContext";
import { useColors } from "@/hooks/useColors";

interface ScoreGaugeProps {
  score: HydrationScore | null;
  size?: number;
  showLabel?: boolean;
}

export function ScoreGauge({ score, size = 200, showLabel = true }: ScoreGaugeProps) {
  const colors = useColors();
  const animValue = useRef(new Animated.Value(0)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);

  const strokeWidth = size * 0.07;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;

  useEffect(() => {
    if (score !== null) {
      Animated.spring(animValue, {
        toValue: score / 4,
        useNativeDriver: false,
        tension: 50,
        friction: 8,
      }).start();

      const listenerId = countAnim.addListener(({ value }) => {
        setDisplayScore(Math.ceil(value));
      });
      Animated.timing(countAnim, {
        toValue: score,
        duration: 900,
        useNativeDriver: false,
      }).start();
      return () => countAnim.removeListener(listenerId);
    }
  }, [score, animValue, countAnim]);

  const scoreColor = score ? getScoreColor(score) : colors.border;
  const scoreLabel = score ? getScoreLabel(score) : "—";
  const scoreNum = score ?? 0;

  const dashoffset = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [arcLength, 0],
  });

  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 135;
  const rotation = startAngle;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={scoreColor} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={scoreColor} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={0}
          rotation={rotation}
          origin={`${cx}, ${cy}`}
          opacity={0.25}
        />
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={scoreColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashoffset}
          rotation={rotation}
          origin={`${cx}, ${cy}`}
        />
      </Svg>
      <View style={styles.centerContent}>
        <Text style={[styles.scoreNumber, { color: scoreColor, fontSize: size * 0.22 }]}>
          {scoreNum > 0 ? (displayScore > 0 ? displayScore : scoreNum) : "—"}
        </Text>
        {showLabel && (
          <Text style={[styles.scoreLabel, { color: colors.mutedForeground, fontSize: size * 0.09 }]}>
            {scoreNum > 0 ? scoreLabel : "No scan yet"}
          </Text>
        )}
      </View>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerContent: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNumber: {
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
  },
  scoreLabel: {
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
