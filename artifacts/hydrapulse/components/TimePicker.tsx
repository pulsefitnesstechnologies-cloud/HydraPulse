import React, { useCallback, useEffect, useRef } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

export interface TimeValue {
  hour: number; // 1-12
  minute: number; // 0-59
  ampm: "AM" | "PM";
}

export const DEFAULT_TIME: TimeValue = { hour: 8, minute: 0, ampm: "AM" };

const ITEM_H = 46;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2); // 2 padding rows top + bottom

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const AMPM_ITEMS = ["AM", "PM"];

interface WheelColumnProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width: number;
}

function WheelColumn({ items, selectedIndex, onSelect, width }: WheelColumnProps) {
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const lastIdxRef = useRef(selectedIndex);

  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
      lastIdxRef.current = selectedIndex;
    }, 60);
    return () => clearTimeout(t);
  }, [selectedIndex]);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const raw = e.nativeEvent.contentOffset.y / ITEM_H;
      const idx = Math.max(0, Math.min(Math.round(raw), items.length - 1));
      if (idx !== lastIdxRef.current) {
        lastIdxRef.current = idx;
        onSelect(idx);
      }
    },
    [items.length, onSelect]
  );

  const padded = [...Array(PAD).fill(""), ...items, ...Array(PAD).fill("")];

  return (
    <View style={[styles.column, { width }]}>
      <View
        pointerEvents="none"
        style={[
          styles.highlight,
          {
            top: PAD * ITEM_H,
            backgroundColor: colors.primary + "14",
            borderColor: colors.primary + "45",
          },
        ]}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate={Platform.OS === "ios" ? "fast" : 0.88}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        bounces={false}
        nestedScrollEnabled
      >
        {padded.map((item, i) => {
          const realIdx = i - PAD;
          const dist = Math.abs(realIdx - selectedIndex);
          const isSelected = realIdx === selectedIndex;
          return (
            <View key={i} style={styles.item}>
              <Text
                style={[
                  styles.itemText,
                  {
                    color: item === "" ? "transparent" : isSelected ? colors.foreground : colors.mutedForeground,
                    fontFamily: isSelected ? "Inter_700Bold" : "Inter_400Regular",
                    fontSize: isSelected ? 19 : 16,
                    opacity: item === "" ? 0 : dist === 0 ? 1 : dist === 1 ? 0.55 : 0.2,
                  },
                ]}
              >
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface TimePickerProps {
  value: TimeValue;
  onChange: (v: TimeValue) => void;
}

export function TimePicker({ value, onChange }: TimePickerProps) {
  const colors = useColors();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <WheelColumn
        items={HOURS}
        selectedIndex={value.hour - 1}
        onSelect={(i) => onChange({ ...value, hour: i + 1 })}
        width={68}
      />
      <View style={[styles.colon, { backgroundColor: colors.border }]} />
      <WheelColumn
        items={MINUTES}
        selectedIndex={value.minute}
        onSelect={(i) => onChange({ ...value, minute: i })}
        width={68}
      />
      <View style={[styles.colon, { backgroundColor: colors.border }]} />
      <WheelColumn
        items={AMPM_ITEMS}
        selectedIndex={value.ampm === "AM" ? 0 : 1}
        onSelect={(i) => onChange({ ...value, ampm: i === 0 ? "AM" : "PM" })}
        width={56}
      />
    </View>
  );
}

export function to24Hour(v: TimeValue): { hour: number; minute: number } {
  let h = v.hour;
  if (v.ampm === "AM" && v.hour === 12) h = 0;
  else if (v.ampm === "PM" && v.hour !== 12) h = v.hour + 12;
  return { hour: h, minute: v.minute };
}

export function formatTime(v: TimeValue): string {
  const m = String(v.minute).padStart(2, "0");
  return `${v.hour}:${m} ${v.ampm}`;
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: ITEM_H * VISIBLE,
    borderRadius: 16,
    overflow: "hidden",
    paddingHorizontal: 8,
  },
  column: { overflow: "hidden" },
  highlight: {
    position: "absolute",
    left: 4,
    right: 4,
    height: ITEM_H,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 0,
  },
  item: {
    height: ITEM_H,
    justifyContent: "center",
    alignItems: "center",
  },
  itemText: { textAlign: "center", fontWeight: "400" },
  colon: { width: 1, height: 24, marginHorizontal: 2 },
});
