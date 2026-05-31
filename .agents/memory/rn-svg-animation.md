---
name: react-native-svg animation
description: How to animate SVG content reliably in react-native-svg on native iOS/Android
---

## Rule
Only leaf-element props update reliably via React state or Animated.Value in react-native-svg on native. Container element (`G`) `transform` prop changes are NOT propagated to native.

## What works
- `<AnimatedCircle strokeDashoffset={animValue} />` — confirmed working
- `<Path d={computedString} />` — `d` prop updated from RAF state each frame — confirmed working (same native update path as AnimatedCircle)

## What does NOT work
- `<G transform="translate(x,y)">` prop updated via state → silently ignored on native
- `<AnimatedG style={{transform: [{translateX: ...}]}}>`  — style.transform on SVG elements is View-only, not forwarded to native SVG
- `<G x={animValue} y={animValue}>` — numeric x/y props on G are not animated

## How to apply
For wave/fill animations: compute absolute SVG path coordinates (including slosh offset and fill Y) directly in a function called from RAF state, pass result as `<Path d={...}>`. No G wrapper needed.

**Why:** react-native-svg processes prop updates per-element type; leaf elements (Path, Circle, Rect) go through the same update channel as Animated; container G does not.
