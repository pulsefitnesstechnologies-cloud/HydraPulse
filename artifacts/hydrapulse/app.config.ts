import { ConfigContext, ExpoConfig } from "expo/config";
import { withDangerousMod, withEntitlementsPlist } from "@expo/config-plugins";
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
  require 'fileutils'
  #
  # LAYER 1 — physical stub file, created here (during pod install) so it
  # exists on disk before Xcode ever tries to open the header.
  #
  # installer.sandbox.root = absolute path to ios/Pods/
  # We place the stub INSIDE the Pods sandbox so $(PODS_ROOT)/FollyStubs
  # resolves to it with no ".." traversal (more reliable across Xcode versions).
  #
  # PRIMARY: Place the stub inside the prebuilt ReactNativeDependencies headers
  # directory. The compiler already has -I.../ReactNativeDependencies in its
  # search path (set by CocoaPods xcconfig for every pod). The prebuilt
  # folly/Expected.h does #include <folly/coro/Coroutine.h>, which the compiler
  # resolves as ReactNativeDependencies/folly/coro/Coroutine.h. We create that
  # file here so the include succeeds. No HEADER_SEARCH_PATHS change needed.
  _folly_rnd_coro_dir  = installer.sandbox.root.join('Headers', 'Public', 'ReactNativeDependencies', 'folly', 'coro')
  _folly_rnd_coro_file = _folly_rnd_coro_dir.join('Coroutine.h')
  FileUtils.mkdir_p(_folly_rnd_coro_dir)
  File.write(_folly_rnd_coro_file, "#pragma once\\n// HydraPulse stub: folly/coro/Coroutine.h omitted from RN 0.81 prebuilt Folly\\n") unless _folly_rnd_coro_file.exist?
  # SECONDARY (belt-and-suspenders): also place stub in FollyStubs/ and register
  # it via HEADER_SEARCH_PATHS, in case the ReactNativeDependencies path differs
  # across Xcode or CocoaPods versions.
  _folly_stub_dir  = installer.sandbox.root.join('FollyStubs', 'folly', 'coro')
  _folly_stub_file = _folly_stub_dir.join('Coroutine.h')
  FileUtils.mkdir_p(_folly_stub_dir)
  File.write(_folly_stub_file, "#pragma once\\n// HydraPulse: folly/coro/Coroutine.h stub\\n// RN 0.81 prebuilt Folly omits coro/ headers.\\n") unless _folly_stub_file.exist?
  _folly_stub_hsp  = '"$(PODS_ROOT)/FollyStubs"'
  #
  # LAYER 2 — preprocessor flags so guarded includes also resolve to nothing.
  #
  _folly_defs = %w[FOLLY_NO_CONFIG=1 FOLLY_MOBILE=1 FOLLY_USE_LIBCPP=1 FOLLY_CFG_NO_COROUTINES=1 FOLLY_HAS_COROUTINES=0]
  _folly_cxx  = _folly_defs.map { |d| "-D#{d}" }.join(' ')
  #
  # Apply to every pod target (covers RNReanimated, VisionCamera, worklets-core,
  # RNAppleHealthKit, ReactCodegen, and all others).
  #
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      # HEADER_SEARCH_PATHS — stub dir first
      _hsp = config.build_settings['HEADER_SEARCH_PATHS'].to_s
      unless _hsp.include?('FollyStubs')
        config.build_settings['HEADER_SEARCH_PATHS'] = _folly_stub_hsp + ' ' + (_hsp.empty? ? '$(inherited)' : _hsp)
      end
      # GCC_PREPROCESSOR_DEFINITIONS — handles String or Array value from CocoaPods
      _pp = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS']
      if _pp.is_a?(Array)
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = (_pp | _folly_defs)
      elsif !(_pp.to_s.include?('FOLLY_CFG_NO_COROUTINES'))
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = (_pp || '$(inherited)').to_s + ' ' + _folly_defs.join(' ')
      end
      # OTHER_CPLUSPLUSFLAGS — belt-and-suspenders for C++ TUs
      _cxx = config.build_settings['OTHER_CPLUSPLUSFLAGS'].to_s
      unless _cxx.include?('FOLLY_CFG_NO_COROUTINES')
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] = (_cxx.empty? ? '$(inherited)' : _cxx) + ' ' + _folly_cxx
      end
    end
  end
  #
  # Also apply HEADER_SEARCH_PATHS to the main app target (HydraPulse.xcodeproj)
  # in case any app-target C++ compilation unit includes Folly headers directly.
  #
  installer.aggregate_targets.each do |agg|
    next unless agg.user_project
    agg.user_project.targets.each do |target|
      target.build_configurations.each do |config|
        _hsp = config.build_settings['HEADER_SEARCH_PATHS'].to_s
        unless _hsp.include?('FollyStubs')
          config.build_settings['HEADER_SEARCH_PATHS'] = _folly_stub_hsp + ' ' + (_hsp.empty? ? '$(inherited)' : _hsp)
        end
        _pp = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS']
        if _pp.is_a?(Array)
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = (_pp | _folly_defs)
        elsif !(_pp.to_s.include?('FOLLY_CFG_NO_COROUTINES'))
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = (_pp || '$(inherited)').to_s + ' ' + _folly_defs.join(' ')
        end
      end
    end
    agg.user_project.save
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

      // ── patch 2 (was 2): react-native-vision-camera FrameProcessors subspec ───
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

      // ── patch 3: react-native-worklets* invalidate fix ───────────────
      // Both react-native-worklets-core and react-native-worklets call
      // C++ worklet teardown synchronously inside -[Worklets invalidate],
      // blocking the JS thread long enough for RCTTurboModuleManager to
      // time out with "Timed out waiting for modules to be invalidated"
      // on new arch (iOS). The fix dispatches the teardown to a background
      // queue so the calling thread returns immediately.
      //
      // We use a flexible regex (not a fixed string) so the patch survives
      // minor version differences in whitespace or surrounding code.
      const patchWorkletsInvalidate = (mmPath: string): void => {
        if (!fs.existsSync(mmPath)) return;
        let src = fs.readFileSync(mmPath, "utf-8");
        // Skip if already patched or no JsiWorklet teardown present
        if (src.includes("dispatch_async") && src.includes("JsiWorklet")) return;
        if (!src.includes("JsiWorklet")) return;

        // Match any ObjC -[* invalidate] method body that contains JsiWorklet calls.
        // [\s\S]*? is non-greedy so we stop at the first closing brace.
        const patched = src.replace(
          /(- \(void\)invalidate \{)([\s\S]*?)(\n\})/g,
          (_match, open: string, body: string, close: string) => {
            if (!body.includes("JsiWorklet")) return _match;
            if (body.includes("dispatch_async")) return _match; // already patched

            // Separate JsiWorklet teardown lines from other lines (e.g. _bridge = nil)
            const lines = body.split("\n");
            const teardownLines: string[] = [];
            const otherLines: string[] = [];
            for (const line of lines) {
              if (line.includes("JsiWorklet") || line.includes("invalidateDefaultInstance") || line.includes("invalidateInstance")) {
                teardownLines.push(line);
              } else {
                otherLines.push(line);
              }
            }
            if (teardownLines.length === 0) return _match;

            const asyncBlock =
              "\n  // HydraPulse patch: dispatch C++ worklet teardown async so\n" +
              "  // RCTTurboModuleManager doesn't time out waiting for invalidation.\n" +
              "  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{\n" +
              teardownLines.join("\n") + "\n" +
              "  });";
            return `${open}${asyncBlock}${otherLines.join("\n")}${close}`;
          }
        );
        if (patched !== src) fs.writeFileSync(mmPath, patched);
      };

      // Patch both worklets packages and look in both the direct symlink
      // location and the pnpm virtual store (which EAS build servers use).
      const gitRoot = path.resolve(root, "..", "..");
      const pnpmStore = path.join(gitRoot, "node_modules", ".pnpm");
      const workletsPkgs = [
        "react-native-worklets-core",
        "react-native-worklets",
      ];
      for (const pkg of workletsPkgs) {
        // Direct symlink (standard node_modules)
        patchWorkletsInvalidate(path.join(root, "node_modules", pkg, "ios", "Worklets.mm"));
        // pnpm virtual store
        if (fs.existsSync(pnpmStore)) {
          for (const entry of fs.readdirSync(pnpmStore)) {
            if (!entry.startsWith(pkg.replace("/", "+") + "@")) continue;
            patchWorkletsInvalidate(
              path.join(pnpmStore, entry, "node_modules", pkg, "ios", "Worklets.mm")
            );
          }
        }
      }

      // ── patch 4: @kingstinct/react-native-healthkit isBigInt → isInt64 ─
      // healthkit@12.2.0 was generated against a nitro-modules pre-release
      // that renamed the BigInt helpers. react-native-nitro-modules@0.35.x
      // only has isInt64/getInt64; isBigInt/getBigInt don't exist → Swift
      // compile error. We patch QuantityTypeModule.swift directly.
      //
      // The file lives in the root pnpm virtual store (.pnpm/<pkg>/...), not
      // in this package's node_modules/. root = artifacts/hydrapulse, so the
      // git root (where the pnpm store is) is two levels up.
      const patchHkBigInt = (swiftPath: string) => {
        if (!fs.existsSync(swiftPath)) return;
        let src = fs.readFileSync(swiftPath, "utf-8");
        if (!src.includes("isBigInt") && !src.includes("getBigInt")) return;
        src = src
          .replace(/anyMap\.isBigInt\(key:/g, "anyMap.isInt64(key:")
          .replace(/anyMap\.getBigInt\(key:/g, "anyMap.getInt64(key:");
        fs.writeFileSync(swiftPath, src);
      };
      // Try direct symlink path first (works when pnpm creates one here)
      patchHkBigInt(path.join(root, "node_modules", "@kingstinct", "react-native-healthkit", "ios", "QuantityTypeModule.swift"));
      // pnpmStore already declared above (patch 3 shares the same root/pnpmStore)
      if (fs.existsSync(pnpmStore)) {
        const hkPrefix = "@kingstinct+react-native-healthkit@";
        for (const entry of fs.readdirSync(pnpmStore)) {
          if (!entry.startsWith(hkPrefix)) continue;
          patchHkBigInt(
            path.join(pnpmStore, entry, "node_modules", "@kingstinct", "react-native-healthkit", "ios", "QuantityTypeModule.swift")
          );
        }
      }

      // ── patch 5: folly/coro/Coroutine.h stub ──────────────────────────
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
    runtimeVersion: {
      policy: "appVersion",
    },
    updates: {
      url: "https://u.expo.dev/15fd2666-3b4a-448c-bfe4-efdd1d70f44a",
    },
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

      // ── HealthKit — @kingstinct/react-native-healthkit config plugin ─────
      // Proper Turbo Module (new-arch native) — works with newArchEnabled: true.
      // Wires the HealthKit entitlement, NSHealth* usage strings, and pod.
      [
        "@kingstinct/react-native-healthkit",
        {
          NSHealthShareUsageDescription:
            "HydraPulse reads heart rate and HRV data from Apple Health to enhance your hydration insights.",
          NSHealthUpdateUsageDescription:
            "HydraPulse saves hydration data to Apple Health for tracking over time.",
        },
      ],

      "expo-font",
      "expo-web-browser",
      [
        "expo-media-library",
        {
          photosPermission: "HydraPulse saves your hydration scan results to your photo library.",
          savePhotosPermission: "HydraPulse saves your hydration scan results to your photo library.",
          isAccessMediaLocationEnabled: false,
        },
      ],
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
      // Resolved at build time from the Replit environment.
      // REPLIT_DOMAINS is a comma-separated list of public domains for this
      // deployment. We take the first one so Settings can open the hosted
      // privacy policy in the system browser. Falls back to null when building
      // outside Replit (e.g. local EAS builds) — update LEGAL_BASE_URL in
      // that case or set EXPO_PUBLIC_LEGAL_BASE_URL.
      legalBaseUrl: process.env.EXPO_PUBLIC_LEGAL_BASE_URL
        ?? (process.env.REPLIT_DOMAINS
          ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}/api`
          : null),
    },
  };

  // Apply programmatic plugins — inlined so no separate file resolution is
  // needed during the EAS "Read app config" phase.
  //
  // Order matters: podspec patch must run before the Folly Podfile hook so
  // that CocoaPods sees a clean patched podspec when it resolves pods.
  let result = withNativeModulePodspecPatches(appConfig);
  result = withFollyNoCoroutines(result);

  // Belt-and-suspenders entitlement: the @kingstinct/react-native-healthkit
  // plugin already adds com.apple.developer.healthkit, but we also set it here
  // to guarantee it survives any plugin ordering edge cases in EAS managed
  // provisioning. Also add background-delivery for Watch monitoring.
  result = withEntitlementsPlist(result, (cfg) => {
    cfg.modResults["com.apple.developer.healthkit"] = true;
    cfg.modResults["com.apple.developer.healthkit.background-delivery"] = true;
    // Time Sensitive entitlement lets scan alarms and reminders break through
    // Focus modes (Do Not Disturb, Sleep, Driving, etc.) on both iPhone and
    // Apple Watch — exactly like alarm and health apps.
    cfg.modResults["com.apple.developer.usernotifications.time-sensitive"] = true;
    return cfg;
  });

  return result;
};
