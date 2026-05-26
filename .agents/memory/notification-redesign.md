---
name: notification redesign
description: Architecture for ScanAlarm + SmartReminder system replacing the old interval-based watch monitor
---

**Rule:** The notification/alarm system is split across three hooks. Keep responsibilities as designed.

**Why:** The old single-file approach mixed scheduling, storage, and alarm-trigger logic. The new split is:
- `useNotifications.ts` — owns `ScanAlarm` and `SmartReminder` types, AsyncStorage persistence, daily CRON scheduling via expo-notifications, and `sendScanResultNotification`.
- `useWatchMonitor.ts` — owns alarm-window time check on app foreground (AppState), alert threshold logic, `estimateHydrationFromMetrics`. Accepts `scanAlarms` from outside.
- `HealthContext.tsx` — bridges both: passes `notif.scanAlarms` into `useWatchMonitor`, exposes `updateScanAlarm` / `updateSmartReminder` / `setAlertThreshold` to UI.

**How to apply:** When adding new notification features, add types/scheduling to `useNotifications`, add trigger logic to `useWatchMonitor`, expose the new API through `HealthContext`. Settings screen consumes via `useHealth()`.
