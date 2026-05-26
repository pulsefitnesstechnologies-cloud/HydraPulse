---
name: expo-updates plugin
description: expo-updates in plugins[] crashes Expo dev server when the package isn't locally installed
---

**Rule:** Do not include `"expo-updates"` in the `plugins[]` array in `app.config.ts` for the Expo Go / Metro dev workflow.

**Why:** The Expo config plugin resolver runs at dev-server startup. If `expo-updates` is listed as a plugin but not installed in `node_modules`, the server crashes with `PluginError: Failed to resolve plugin for module "expo-updates"`. The package is only needed for EAS managed builds (OTA updates), not for local development.

**How to apply:** Keep `expo-updates` out of `plugins[]`. The `updates.url` and `runtimeVersion` fields in the config are read independently and do not require the plugin at dev time.
