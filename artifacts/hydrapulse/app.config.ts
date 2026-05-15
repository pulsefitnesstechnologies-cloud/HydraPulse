import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "HydraPulse",
  slug: "hydrapulse",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "hydrapulse",
  userInterfaceStyle: "automatic",
  // react-native-health uses the legacy bridge (pre-TurboModules).
  // New architecture causes initHealthKit to error immediately without ever
  // showing the iOS permission sheet. Disabled until rn-health ships a JSI module.
  newArchEnabled: false,

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

      // ── Background notifications (Watch monitoring reminders) ────────────
      UIBackgroundModes: ["remote-notification"],
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
    [
      "expo-router",
      {
        origin: "https://replit.com/",
      },
    ],

    // ── Camera — VisionCamera v4 with frame processor support ────────────
    // Enables real per-frame pixel access for PPG heart rate detection.
    [
      "react-native-vision-camera",
      {
        cameraPermissionText:
          "HydraPulse uses the rear camera and torch to illuminate your fingertip for PPG-based hydration estimation.",
        enableMicrophonePermission: false,
      },
    ],

    // ── HealthKit — config plugin required for EAS managed builds ─────────
    // Without this entry EAS skips native HealthKit project setup and pod
    // install fails. The plugin wires entitlements + infoPlist descriptions.
    [
      "react-native-health",
      {
        healthSharePermission:
          "HydraPulse reads heart rate and HRV data from Apple Health to enhance your hydration insights.",
        healthUpdatePermission:
          "HydraPulse saves your hydration scan scores to Apple Health for tracking over time.",
        isClinicalDataEnabled: false,
      },
    ],

    "expo-font",
    "expo-web-browser",
    [
      "expo-notifications",
      {
        icon: "./assets/images/icon.png",
        color: "#0EA5E9",
        sounds: [],
      },
    ],
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
