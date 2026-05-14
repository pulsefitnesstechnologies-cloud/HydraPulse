import { ConfigContext, ExpoConfig } from "expo/config";

const isDevelopment = process.env.EXPO_PUBLIC_ENV === "development";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "HydraPulse",
  slug: "hydrapulse",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "hydrapulse",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,

  splash: {
    image: "./assets/images/icon.png",
    resizeMode: "contain",
    backgroundColor: "#070D1A",
  },

  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.hydrapulse.app",
    buildNumber: "1",

    // ── HealthKit capability ──────────────────────────────────────────────
    // Enables the com.apple.developer.healthkit entitlement so the app can
    // read heart rate / HRV from HealthKit and write hydration scores back.
    entitlements: {
      "com.apple.developer.healthkit": true,
      "com.apple.developer.healthkit.access": [],
    },

    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,

      // ── Camera + torch ──────────────────────────────────────────────────
      NSCameraUsageDescription:
        "HydraPulse uses the rear camera and torch to illuminate your fingertip for PPG-based hydration estimation.",

      // ── Microphone (voice-timbre analysis, future use) ──────────────────
      NSMicrophoneUsageDescription:
        "HydraPulse may use the microphone for voice-timbre hydration analysis in a future update.",

      // ── HealthKit ───────────────────────────────────────────────────────
      NSHealthShareUsageDescription:
        "HydraPulse reads heart rate and HRV data from Apple Health to enhance your hydration insights.",
      NSHealthUpdateUsageDescription:
        "HydraPulse saves your hydration scan scores to Apple Health for tracking over time.",
    },
  },

  android: {
    package: "com.hydrapulse.app",
    permissions: [
      "android.permission.CAMERA",
      // FLASHLIGHT is automatically granted when CAMERA is granted on Android,
      // but declaring it explicitly ensures torch access on all OEMs.
      "android.permission.FLASHLIGHT",
      "android.permission.RECORD_AUDIO",
      // Health Connect (Android equivalent of HealthKit)
      "android.permission.health.READ_HEART_RATE",
      "android.permission.health.READ_HEART_RATE_VARIABILITY",
      "android.permission.health.WRITE_NUTRITION",
    ],
  },

  web: {
    favicon: "./assets/images/icon.png",
  },

  plugins: [
    // ── expo-dev-client — only for development builds ────────────────────
    ...(isDevelopment ? (["expo-dev-client"] as const) : []),

    [
      "expo-router",
      {
        origin: "https://replit.com/",
      },
    ],

    // ── Camera — VisionCamera v5 with frame processor support ────────────
    // Replaces expo-camera; enables real per-frame pixel access for PPG.
    [
      "react-native-vision-camera",
      {
        cameraPermissionText:
          "HydraPulse uses the rear camera and torch to illuminate your fingertip for PPG-based hydration estimation.",
        enableMicrophonePermission: false,
      },
    ],

    "expo-font",
    "expo-web-browser",
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  extra: {
    eas: {
      projectId: "15fd2666-3b4a-448c-bfe4-efdd1d70f44a",
    },
  },
});
