---
name: EAS OTA update workflow
description: How to push JS code changes to the user's installed dev build via EAS Update
---

## Rule
After any code change the user wants on their physical device, run `eas update` from `artifacts/hydrapulse/` using these flags to avoid two known blockers:

```bash
cd artifacts/hydrapulse && EXPO_TOKEN=$EXPO_TOKEN EAS_SKIP_AUTO_FINGERPRINT=1 EAS_NO_VCS=1 \
  pnpm exec eas update --channel development --message "<what changed>" --non-interactive
```

**Why:**
- `EAS_SKIP_AUTO_FINGERPRINT=1` — fingerprint computation hangs for 2+ minutes in this environment; skipping it is safe for JS-only updates.
- `EAS_NO_VCS=1` — Replit sandbox blocks all git write operations (`index.lock` exists); without this flag EAS errors out at the publish step.
- `EXPO_TOKEN=$EXPO_TOKEN` — credential is stored as a Replit secret; sessions don't persist `eas login`.
- Channel is `development` — this is what the user's installed dev build listens to.

**How to apply:**
Use this exact command every time the user says "push to my phone", "send to the app", "check for updates", or after any feature is complete and they want it on device. The EXPO_TOKEN secret is already saved.

**User flow after publish:**
Shake device → Check for Updates → app reloads with new bundle automatically.
