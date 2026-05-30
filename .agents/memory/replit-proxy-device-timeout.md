---
name: Replit proxy device timeout
description: Expo dev client on physical iOS device cannot load Metro bundle through Replit proxy — proxy kills the connection before the 12 MB bundle downloads.
---

## The rule
Code changes to the JS layer will NOT reach a physical iOS/Android device connected via the Replit expo domain proxy. The device shows "Unknown error: The request timed out." and never loads.

**Why:** The Replit reverse proxy has a request timeout shorter than the time Metro takes to serve a cold iOS bundle (~12 MB). The bundle is built and cached fine on localhost (verified: serves in <2 s after warm-up), but the device's TCP connection through the proxy is dropped before the download completes.

**Confirmed workarounds:**
- `/_expo/static/js/ios/entry.js` returns HTTP 200 instantly on localhost — this is the pre-built static bundle embedded in the dev build, NOT a live Metro bundle. Shake-to-reload on the device reloads this same static file, so JS edits are invisible.
- The only way to get fresh JS onto the device is a new EAS development build (`eas build --profile development --platform ios`) or an EAS OTA update (`eas update`). EAS CLI is not pre-installed in the Replit env but can be added with `npm install -g eas-cli` if an EXPO_TOKEN secret is available.

**How to apply:** When debugging native-device behavior (HealthKit writes, camera, haptics), do not rely on Metro hot reload. Design test paths that are visible in the web preview, or plan for an EAS build cycle.
