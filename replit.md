# HydraPulse

A smart hydration tracker that estimates hydration status using photoplethysmography (PPG) — available on iOS and Android via Expo Go.

## Run & Operate

- `pnpm --filter @workspace/hydrapulse run dev` — run the Expo dev server
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- Scan QR code from Replit URL bar to test on physical device via Expo Go

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo SDK 54, React Native, Expo Router (file-based)
- State: React Context + AsyncStorage (local persistence, no backend required)
- API: Express 5 (shared backend, currently unused by app)
- Charts: react-native-svg
- Icons: @expo/vector-icons (Ionicons)
- Fonts: Inter (400/500/600/700)

## Where things live

- `artifacts/hydrapulse/` — the Expo mobile app
  - `app/_layout.tsx` — root layout with providers, onboarding guard
  - `app/(tabs)/` — main tabs: Home, History, Settings
  - `app/onboarding.tsx` — 4-step onboarding flow
  - `app/scan.tsx` — PPG scan screen (camera + simulation modes)
  - `app/results.tsx` — scan results with tips and metrics
  - `context/HydrationContext.tsx` — shared hydration state + AsyncStorage
  - `constants/colors.ts` — HydraPulse dark-mode brand tokens
  - `components/` — ScoreGauge, TrendChart, WaveformPreview, DisclaimerBanner, PremiumModal

## Architecture decisions

- Frontend-only: all data persisted in AsyncStorage — no backend or database needed for v1
- Simulation mode first: real camera PPG available in camera mode (expo-camera installed)
- Freemium stub: Premium modal and weekly scan limit (5 scans) built in but not enforced by a real payment provider
- Dark mode: full light/dark theme via `constants/colors.ts` and `useColors()` hook
- Safety-first: DisclaimerBanner on every scan and result screen

## Product

- 4-step onboarding (welcome, PPG explainer, phone mode, privacy)
- Home dashboard: hydration score gauge, 7-day trend chart, recent scans, quick scan CTA
- Scan screen: phone camera mode + simulation mode, 12-second countdown, live waveform animation, haptic feedback
- Results screen: animated score reveal, personalized tips, heart rate / HRV / confidence metrics
- History screen: stats summary (total, avg, best), 7-day trend chart, full scan log
- Settings: premium upgrade (stubbed), scan mode toggle, Watch/Health stubs, clear history, disclaimers

## User preferences

- Dark-mode friendly UI with soft blues and greens (medical/wellness aesthetic)
- Prominent safety disclaimers on scan and result screens
- No emojis in UI

## Gotchas

- expo-camera and expo-av are installed but camera PPG is simulated — real camera processing requires custom native code beyond Expo Go
- `useNativeDriver` warnings appear in web preview only — these do not affect native device behavior
- NativeTabs (liquid glass) auto-activates on iOS 26+, falls back to classic tabs on older iOS/Android

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
