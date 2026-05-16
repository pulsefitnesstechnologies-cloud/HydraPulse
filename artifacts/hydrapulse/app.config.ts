import { ConfigContext, ExpoConfig } from "expo/config";
import { withDangerousMod } from "@expo/config-plugins";
import * as path from "path";
import * as fs from "fs";

// ── Folly coroutines fix ────────────────────────────────────────────────────
// Appended as a Podfile post_install hook so it applies to every CocoaPod
// target. Folly auto-detects C++20 coroutine support from compiler flags; when
// any pod includes a Folly header (even transitively), Folly tries to pull in
// folly/coro/Coroutine.h — a header that is not shipped in the Folly bundle
// bundled with React Native. Setting FOLLY_CFG_NO_COROUTINES=1 globally tells
// Folly to skip coroutines regardless of compiler capability.
const FOLLY_PODFILE_HOOK = `
# ── HydraPulse: disable Folly C++20 coroutines globally ────────────────────
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      defs = Array(config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'])
      defs |= ['$(inherited)', 'FOLLY_NO_CONFIG=1', 'FOLLY_CFG_NO_COROUTINES=1']
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
    end
  end
end
# ───────────────────────────────────────────────────────────────────────────
`;

function withFollyNoCoroutines(config: ExpoConfig): ExpoConfig {
  return withDangerousMod(config, [
    "ios",
    (modConfig) => {
      const podfilePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        "Podfile"
      );
      if (!fs.existsSync(podfilePath)) return modConfig;
      const contents = fs.readFileSync(podfilePath, "utf-8");
      if (contents.includes("FOLLY_CFG_NO_COROUTINES")) return modConfig;
      fs.writeFileSync(podfilePath, contents + FOLLY_PODFILE_HOOK);
      return modConfig;
    },
  ]);
}

// ── Native module podspec patches ───────────────────────────────────────────
// Several third-party packages ship podspecs written for old React Native
// versions. Running pod install with modern RN (0.76+) fails immediately
// because the referenced pods no longer exist.
//
// Packages patched here:
//
//   react-native-health@1.19 (RN 0.59 era podspec)
//     • swift_version = '4.2'  — Xcode 14+ dropped Swift 4.2; raises
//       "Specifications for Swift 4.2 are no longer supported."
//     • s.dependency 'React'   — The 'React' umbrella pod was removed in
//       RN 0.60. CocoaPods errors "Unable to find a specification for 'React'".
//
//   react-native-vision-camera@4.6.4 FrameProcessors subspec
//     • fp.dependency "React"  — Same dead pod in the FrameProcessors subspec.
//       Since fp.dependency "React-Core" is already added by the outer spec,
//       replacing with "React-Core" is safe and correct.
//
// These patches run during expo prebuild (before CocoaPods sees any podspec).
function withNativeModulePodspecPatches(config: ExpoConfig): ExpoConfig {
  return withDangerousMod(config, [
    "ios",
    (modConfig) => {
      const root = modConfig.modRequest.projectRoot;

      // ── patch 1: react-native-health ──────────────────────────────────
      const hkPath = path.join(
        root, "node_modules", "react-native-health", "RNAppleHealthKit.podspec"
      );
      if (fs.existsSync(hkPath)) {
        let hk = fs.readFileSync(hkPath, "utf-8");
        if (!hk.includes("install_modules_dependencies")) {
          hk = hk.replace(
            /s\.swift_version\s*=\s*['"]4\.2['"]/,
            "s.swift_version = '5.0'"
          );
          hk = hk.replace(
            /s\.dependency\s+['"]React['"]/,
            "install_modules_dependencies(s)"
          );
          fs.writeFileSync(hkPath, hk);
        }
      }

      // ── patch 2: react-native-vision-camera FrameProcessors subspec ───
      const vcPath = path.join(
        root, "node_modules", "react-native-vision-camera", "VisionCamera.podspec"
      );
      if (fs.existsSync(vcPath)) {
        let vc = fs.readFileSync(vcPath, "utf-8");
        // Target only the FrameProcessors subspec line (fp.dependency "React")
        // leaving the unrelated 's.subspec 'React'' block untouched.
        if (vc.includes('fp.dependency "React"')) {
          vc = vc.replace('fp.dependency "React"', 'fp.dependency "React-Core"');
          fs.writeFileSync(vcPath, vc);
        }
      }

      return modConfig;
    },
  ]);
}
// ───────────────────────────────────────────────────────────────────────────

export default ({ config }: ConfigContext): ExpoConfig => {
  const appConfig: ExpoConfig = {
    ...config,
    name: "HydraPulse",
    slug: "hydrapulse",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "hydrapulse",
    userInterfaceStyle: "automatic",
    // New architecture enabled — all native packages in this project support
    // JSI / Fabric. react-native-health was replaced with
    // @kingstinct/react-native-healthkit which is built on NitroModules (new arch).
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

      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,

        // ── Camera + torch ────────────────────────────────────────────────
        NSCameraUsageDescription:
          "HydraPulse uses the rear camera and torch to illuminate your fingertip for PPG-based hydration estimation.",

        // ── Microphone (future use) ───────────────────────────────────────
        NSMicrophoneUsageDescription:
          "HydraPulse may use the microphone for voice-timbre hydration analysis in a future update.",

        // ── Background notifications (Watch monitoring reminders) ─────────
        UIBackgroundModes: ["remote-notification"],
      },
      // NOTE: HealthKit entitlement + NSHealth* descriptions are injected by
      // the @kingstinct/react-native-healthkit config plugin below.
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
      // expo-dev-client must be early — it sets up the custom native launcher
      // that lets you run development builds with custom native modules.
      "expo-dev-client",

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

      // ── HealthKit — react-native-health config plugin ────────────────────
      // Wires the HealthKit entitlement and NSHealth* usage strings.
      // react-native-health uses the legacy bridge; the new-arch interop layer
      // in RN 0.76+ lets it work alongside newArchEnabled: true.
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
  };

  // Apply programmatic plugins — inlined so no separate file resolution is
  // needed during the EAS "Read app config" phase.
  //
  // Order matters: podspec patch must run before the Folly Podfile hook so
  // that CocoaPods sees a clean patched podspec when it resolves pods.
  let result = withNativeModulePodspecPatches(appConfig);
  result = withFollyNoCoroutines(result);
  return result;
};
