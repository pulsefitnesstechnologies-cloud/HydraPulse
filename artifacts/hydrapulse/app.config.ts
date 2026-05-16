import { ConfigContext, ExpoConfig } from "expo/config";
import { withDangerousMod } from "@expo/config-plugins";
import * as path from "path";
import * as fs from "fs";

// ── Folly coroutines fix ────────────────────────────────────────────────────
// CocoaPods only allows ONE post_install block per Podfile. Expo's generated
// Podfile already has one (for react_native_post_install). We must inject
// our Folly preprocessor flags INSIDE that existing block, not add a second.
//
// RN 0.81 ships Folly as a prebuilt Maven artifact. That tarball does NOT
// include folly/coro/Coroutine.h. Third-party pods (reanimated, worklets-core,
// VisionCamera) use Folly headers and, when the C++ compiler supports
// coroutines, Folly tries to pull in the missing header.
//
// Two flags are needed because different Folly versions use different guards:
//   FOLLY_CFG_NO_COROUTINES=1  — checked by newer Folly (2022+)
//   FOLLY_HAS_COROUTINES=0     — checked by older Folly / portability shims
//
// We set them via TWO channels because xcconfig inheritance can silence one:
//   GCC_PREPROCESSOR_DEFINITIONS  — covers C, ObjC, ObjC++, C++
//   OTHER_CPLUSPLUSFLAGS          — explicit -D flags for C++ only
//
// Note on Ruby types: CocoaPods stores GCC_PREPROCESSOR_DEFINITIONS as a
// String (not an Array) when read from xcconfig. We must handle both types.
const FOLLY_INJECTION = `
  # ── HydraPulse: Folly coroutine + deprecation fixes ─────────────────────
  # Two-layer defence for folly/coro/Coroutine.h:
  #   Layer 1 — stub header at ios/FollyStubs/folly/coro/Coroutine.h
  #             prepended to HEADER_SEARCH_PATHS so an unconditional
  #             #include <folly/coro/Coroutine.h> resolves to the stub
  #             instead of failing with "file not found".
  #   Layer 2 — preprocessor flags via GCC_PREPROCESSOR_DEFINITIONS and
  #             OTHER_CPLUSPLUSFLAGS so any guarded code paths skip
  #             coroutine features entirely.
  folly_defs = %w[FOLLY_NO_CONFIG=1 FOLLY_MOBILE=1 FOLLY_USE_LIBCPP=1 FOLLY_CFG_NO_COROUTINES=1 FOLLY_HAS_COROUTINES=0]
  folly_cxx  = folly_defs.map { |d| "-D#{d}" }.join(' ')
  # $(PODS_ROOT) = ios/Pods/ ; $(PODS_ROOT)/.. = ios/ ; ../FollyStubs = ios/FollyStubs
  folly_stub_path = '"$(PODS_ROOT)/../FollyStubs"'
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      # --- HEADER_SEARCH_PATHS: prepend stub dir so it wins over prebuilt Folly ---
      existing_hsp = config.build_settings['HEADER_SEARCH_PATHS'].to_s
      unless existing_hsp.include?('FollyStubs')
        config.build_settings['HEADER_SEARCH_PATHS'] = folly_stub_path + ' ' + (existing_hsp.empty? ? '$(inherited)' : existing_hsp)
      end
      # --- GCC_PREPROCESSOR_DEFINITIONS (may be String or Array in CocoaPods) ---
      existing_pp = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS']
      if existing_pp.is_a?(Array)
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = (existing_pp | folly_defs)
      elsif !(existing_pp.to_s.include?('FOLLY_CFG_NO_COROUTINES'))
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = (existing_pp || '$(inherited)').to_s + ' ' + folly_defs.join(' ')
      end
      # --- OTHER_CPLUSPLUSFLAGS: belt-and-suspenders -D flags for C++ TUs ---
      existing_cxx = config.build_settings['OTHER_CPLUSPLUSFLAGS'].to_s
      unless existing_cxx.include?('FOLLY_CFG_NO_COROUTINES')
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] = (existing_cxx.empty? ? '$(inherited)' : existing_cxx) + ' ' + folly_cxx
      end
      # --- Suppress deprecated HealthKit API warnings from react-native-health ---
      if target.name == 'RNAppleHealthKit'
        existing_cflags = config.build_settings['OTHER_CFLAGS'].to_s
        unless existing_cflags.include?('Wno-deprecated')
          config.build_settings['OTHER_CFLAGS'] = (existing_cflags.empty? ? '$(inherited)' : existing_cflags) + ' -Wno-deprecated-declarations'
        end
      end
    end
  end
  # ─────────────────────────────────────────────────────────────────────────`;

function withFollyNoCoroutines(config: ExpoConfig): ExpoConfig {
  return withDangerousMod(config, [
    "ios",
    (modConfig) => {
      const podfilePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        "Podfile"
      );
      if (!fs.existsSync(podfilePath)) return modConfig;
      let contents = fs.readFileSync(podfilePath, "utf-8");
      if (contents.includes("FOLLY_CFG_NO_COROUTINES")) return modConfig;
      // Inject inside the existing post_install block — right after the
      // opening "post_install do |installer|" line. This keeps the single
      // post_install constraint that CocoaPods enforces.
      contents = contents.replace(
        /^(post_install do \|installer\|)$/m,
        `$1${FOLLY_INJECTION}`
      );
      fs.writeFileSync(podfilePath, contents);
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
      // react-native-health is an OLD BRIDGE module. It only needs React-Core.
      // We intentionally do NOT use install_modules_dependencies(s) because
      // that would add Fabric/ReactCodegen deps for what is a bridge-only
      // module, which can cause pod resolution conflicts with new arch.
      const hkPath = path.join(
        root, "node_modules", "react-native-health", "RNAppleHealthKit.podspec"
      );
      if (fs.existsSync(hkPath)) {
        let hk = fs.readFileSync(hkPath, "utf-8");
        if (hk.includes("s.dependency 'React'")) {
          // Fix 1: Swift 4.2 was dropped by Xcode 14. Use 5.0.
          hk = hk.replace(
            /s\.swift_version\s*=\s*['"]4\.2['"]/,
            "s.swift_version = '5.0'"
          );
          // Fix 2: The 'React' umbrella pod was removed in RN 0.60.
          // Replace with React-Core which is the correct modern pod for
          // old-bridge native modules.
          hk = hk.replace(
            /s\.dependency\s+['"]React['"]/,
            "s.dependency 'React-Core'"
          );
          fs.writeFileSync(hkPath, hk);
        }
      }

      // ── patch 2: react-native-vision-camera FrameProcessors subspec ───
      // VisionCamera v4's FrameProcessors subspec has fp.dependency "React"
      // which is the same dead pod. Replace with React-Core.
      const vcPath = path.join(
        root, "node_modules", "react-native-vision-camera", "VisionCamera.podspec"
      );
      if (fs.existsSync(vcPath)) {
        let vc = fs.readFileSync(vcPath, "utf-8");
        if (vc.includes('fp.dependency "React"')) {
          vc = vc.replace('fp.dependency "React"', 'fp.dependency "React-Core"');
          fs.writeFileSync(vcPath, vc);
        }
      }

      // ── patch 3: folly/coro/Coroutine.h stub ──────────────────────────
      // RN 0.81's prebuilt Maven tarball (ReactNativeDependencies) ships the
      // compiled Folly library but OMITS folly/coro/Coroutine.h and the rest
      // of the coro/ header directory. Third-party pods (reanimated, worklets-
      // core, VisionCamera) sometimes include folly/coro/Coroutine.h without
      // checking FOLLY_HAS_COROUTINES first, causing a hard "file not found"
      // compile error that no preprocessor flag can prevent.
      //
      // Solution: create a minimal stub at ios/FollyStubs/folly/coro/Coroutine.h
      // and prepend ios/FollyStubs to HEADER_SEARCH_PATHS (done in the Podfile
      // post_install injection in withFollyNoCoroutines). The stub satisfies the
      // raw #include. FOLLY_CFG_NO_COROUTINES=1 / FOLLY_HAS_COROUTINES=0 then
      // ensure no actual coroutine code paths are compiled.
      const iosDir = modConfig.modRequest.platformProjectRoot;
      const stubCoroDir = path.join(iosDir, "FollyStubs", "folly", "coro");
      const stubCoroFile = path.join(stubCoroDir, "Coroutine.h");
      if (!fs.existsSync(stubCoroFile)) {
        fs.mkdirSync(stubCoroDir, { recursive: true });
        fs.writeFileSync(
          stubCoroFile,
          [
            "// HydraPulse: folly/coro/Coroutine.h stub",
            "// RN 0.81 prebuilt Folly omits coro/ headers. This stub satisfies",
            "// unconditional #include <folly/coro/Coroutine.h> directives in",
            "// third-party pods. Actual coroutine usage is disabled via",
            "// FOLLY_CFG_NO_COROUTINES=1 and FOLLY_HAS_COROUTINES=0.",
            "#pragma once",
          ].join("\n") + "\n"
        );
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
    // New architecture enabled. react-native-health works via the RN 0.76+
    // interop layer that bridges old-bridge modules into new arch at runtime.
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
