---
name: HealthKit stale closure in stable callbacks
description: Pattern for avoiding stale isAuthorized state in useCallback with empty deps
---

## Rule
Any `useCallback(async () => { ... }, [])` (stable callback, empty deps) that checks `isAuthorized` will capture the initial `false` value and never see updates. Use `isAuthorizedRef.current` instead.

## Pattern
In `useHealthKit`, expose `isAuthorizedRef` in the return value alongside `isAuthorized`. Keep `isAuthorized` for UI rendering (React state triggers re-renders). Use `isAuthorizedRef.current` in stable callbacks that need the always-current value.

```ts
// In useHealthKit return:
return { isAuthorized, isAuthorizedRef, ... };

// In HealthContext stable callback:
if (!hk.isAuthorizedRef.current) {
  const r = await hk.requestAuthorization();
  if (!r.ok) return null;
}
```

**Why:** `runWatchScan` in HealthContext is a stable `useCallback` with deps `[hk.fetchLatest, addScanResult]`. It does NOT include `hk.isAuthorized`, so it always reads the initial value (false). Exposed `isAuthorizedRef` so the always-current value can be read without adding the state to deps.

## Watch Scan "Scan Unavailable" flash — real cause
The flash was NOT due to the stale ref. It was a modal animation artifact:
- On scan success: `watchPhase` goes `"scanning" → "idle"`
- `visible = watchPhase !== "idle"` → Modal starts its fade-out animation
- During the fade, inner JSX re-renders: `watchPhase === "scanning"` is now false → "Scan Unavailable" content renders while modal is still fading out and visible

**Fix:** Change inner conditional from `watchPhase === "scanning"` to `watchPhase !== "failed"`. The spinner renders for both "scanning" and "idle" states, so the fade-out shows the spinner disappearing, not an error flash.

**How to apply:** Any modal that shows different content based on state AND uses a fade/slide animation: make the "normal" branch the default and the "error" branch the explicit check. Never make error the default else-branch when a success-to-hidden transition can pass through it.
