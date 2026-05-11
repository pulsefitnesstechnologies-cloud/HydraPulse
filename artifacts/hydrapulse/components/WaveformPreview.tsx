import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

interface WaveformPreviewProps {
  isActive: boolean;
  width?: number;
  height?: number;
  color?: string;
}

function generatePPGPath(
  width: number,
  height: number,
  offset: number
): string {
  const segments = 3;
  const segW = width / segments;
  const midY = height / 2;
  const amplitude = height * 0.35;

  let d = `M 0 ${midY}`;

  for (let s = 0; s < segments; s++) {
    const baseX = s * segW + offset;
    const x0 = baseX % width;

    const bX = x0 + segW * 0.15;
    const cX = x0 + segW * 0.25;
    const peakX = x0 + segW * 0.35;
    const dicX = x0 + segW * 0.5;
    const endX = x0 + segW;

    d += ` C ${x0 + segW * 0.05} ${midY},`;
    d += ` ${bX} ${midY + amplitude * 0.3},`;
    d += ` ${cX} ${midY - amplitude * 0.1}`;
    d += ` Q ${peakX} ${midY - amplitude},`;
    d += ` ${peakX + segW * 0.05} ${midY - amplitude * 0.3}`;
    d += ` C ${dicX - segW * 0.02} ${midY + amplitude * 0.15},`;
    d += ` ${dicX + segW * 0.08} ${midY + amplitude * 0.08},`;
    d += ` ${dicX + segW * 0.1} ${midY + amplitude * 0.05}`;
    d += ` C ${endX - segW * 0.1} ${midY},`;
    d += ` ${endX - segW * 0.05} ${midY},`;
    d += ` ${endX} ${midY}`;
  }

  return d;
}

export function WaveformPreview({
  isActive,
  width = 300,
  height = 80,
  color,
}: WaveformPreviewProps) {
  const colors = useColors();
  const waveColor = color ?? colors.primary;
  const offsetRef = useRef(new Animated.Value(0)).current;
  const opacityRef = useRef(new Animated.Value(isActive ? 1 : 0.3)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isActive) {
      Animated.timing(opacityRef, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      animRef.current = Animated.loop(
        Animated.timing(offsetRef, {
          toValue: -width / 3,
          duration: 800,
          useNativeDriver: false,
        })
      );
      animRef.current.start();
      return () => {
        animRef.current?.stop();
        offsetRef.setValue(0);
      };
    } else {
      animRef.current?.stop();
      Animated.timing(opacityRef, {
        toValue: 0.3,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isActive, width, offsetRef, opacityRef]);

  const segments = [0, width / 3, (width * 2) / 3];

  return (
    <Animated.View style={[styles.container, { width, height, opacity: opacityRef }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path
          d={generatePPGPath(width, height, 0)}
          stroke={waveColor}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.3}
        />
        <Path
          d={generatePPGPath(width, height, width / 6)}
          stroke={waveColor}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});
