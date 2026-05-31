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

## Why
`runWatchScan` in HealthContext is a stable `useCallback` with deps `[hk.fetchLatest, addScanResult]`. It does NOT include `hk.isAuthorized`, so it always reads the initial value (false). On every tap it entered the re-auth path; if `requestAuthorization` threw (already-determined HealthKit state), it returned `{ok: false}` → "Scan Unavailable" flash before the scan completed.

**How to apply:** Any stable callback (empty or minimal deps) in HealthContext that gates on authorization must read `hk.isAuthorizedRef.current`, not `hk.isAuthorized`.
