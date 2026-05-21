const { withDangerousMod, withEntitlementsPlist } = require(
  require("path").join(__dirname, "artifacts", "hydrapulse", "node_modules", "@expo", "config-plugins")
);
const path = require("path");
const fs = require("fs");

// Absolute path to the hydrapulse sub-package.
// All asset refs and plugin look-ups are relative to this so they resolve
// correctly on the user's local machine AND on EAS Cloud (which always runs
// prebuild from the git root, not from artifacts/hydrapulse).
const HP = path.join(__dirname, "artifacts", "hydrapulse");

// Helper: require a plugin's app.plugin.js from the hydrapulse node_modules.
// app.plugin.js files use ES module "export default", so require() wraps the
// result in { default: fn }.  We unwrap it so Expo receives the bare function.
function hp(pkg) {
  const mod = require(path.join(HP, "node_modules", pkg, "app.plugin.js"));
  return mod.default ?? mod;
}

// ── Folly coroutines fix ─────────────────────────────────────────────────────
const FOLLY_INJECTION = `
  # ── HydraPulse: Folly coroutine + deprecation fixes ─────────────────────
  require 'fileutils'
  _folly_rnd_coro_dir  = installer.sandbox.root.join('Headers', 'Public', 'ReactNativeDependencies', 'folly', 'coro')
  _folly_rnd_coro_file = _folly_rnd_coro_dir.join('Coroutine.h')
  FileUtils.mkdir_p(_folly_rnd_coro_dir)
  File.write(_folly_rnd_coro_file, "#pragma once\\n// HydraPulse stub\\n") unless _folly_rnd_coro_file.exist?
  _folly_stub_dir  = installer.sandbox.root.join('FollyStubs', 'folly', 'coro')
  _folly_stub_file = _folly_stub_dir.join('Coroutine.h')
  FileUtils.mkdir_p(_folly_stub_dir)
  File.write(_folly_stub_file, "#pragma once\\n// HydraPulse: folly/coro/Coroutine.h stub\\n") unless _folly_stub_file.exist?
  _folly_stub_hsp  = '"$(PODS_ROOT)/FollyStubs"'
  _folly_defs = %w[FOLLY_NO_CONFIG=1 FOLLY_MOBILE=1 FOLLY_USE_LIBCPP=1 FOLLY_CFG_NO_COROUTINES=1 FOLLY_HAS_COROUTINES=0]
  _folly_cxx  = _folly_defs.map { |d| "-D#{d}" }.join(' ')
  installer.pods_project.targets.each do |target|
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
      _cxx = config.build_settings['OTHER_CPLUSPLUSFLAGS'].to_s
      unless _cxx.include?('FOLLY_CFG_NO_COROUTINES')
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] = (_cxx.empty? ? '$(inherited)' : _cxx) + ' ' + _folly_cxx
      end
    end
  end
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

function withFollyNoCoroutines(config) {
  return withDangerousMod(config, [
    "ios",
    (modConfig) => {
      const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, "Podfile");
      if (!fs.existsSync(podfilePath)) return modConfig;
      let contents = fs.readFileSync(podfilePath, "utf-8");
      if (contents.includes("FOLLY_CFG_NO_COROUTINES")) return modConfig;
      contents = contents.replace(
        /^(post_install do \|installer\|)$/m,
        `$1${FOLLY_INJECTION}`
      );
      fs.writeFileSync(podfilePath, contents);
      return modConfig;
    },
  ]);
}

function withNativeModulePodspecPatches(config) {
  return withDangerousMod(config, [
    "ios",
    (modConfig) => {
      // Always look in the hydrapulse package for podspecs, regardless of
      // what directory EAS uses as prebuild CWD.
      const root = HP;

      // react-native-vision-camera FrameProcessors subspec
      const vcPath = path.join(root, "node_modules", "react-native-vision-camera", "VisionCamera.podspec");
      if (fs.existsSync(vcPath)) {
        let vc = fs.readFileSync(vcPath, "utf-8");
        if (vc.includes('fp.dependency "React"')) {
          vc = vc.replace('fp.dependency "React"', 'fp.dependency "React-Core"');
          fs.writeFileSync(vcPath, vc);
        }
      }

      // react-native-worklets-core invalidate fix
      const workletsMMPath = path.join(root, "node_modules", "react-native-worklets-core", "ios", "Worklets.mm");
      if (fs.existsSync(workletsMMPath)) {
        let wk = fs.readFileSync(workletsMMPath, "utf-8");
        if (
          wk.includes("RNWorklet::JsiWorkletContext::invalidateDefaultInstance();") &&
          !wk.includes("dispatch_async")
        ) {
          wk = wk.replace(
            `- (void)invalidate {
  RNWorklet::JsiWorkletContext::invalidateDefaultInstance();
  RNWorklet::JsiWorkletApi::invalidateInstance();
  _bridge = nil;
}`,
            `- (void)invalidate {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    RNWorklet::JsiWorkletContext::invalidateDefaultInstance();
    RNWorklet::JsiWorkletApi::invalidateInstance();
  });
  _bridge = nil;
}`
          );
          fs.writeFileSync(workletsMMPath, wk);
        }
      }

      // @kingstinct/react-native-healthkit isBigInt/getBigInt → isInt64/getInt64
      // healthkit@12.2.0 was generated against a nitro-modules pre-release that
      // renamed the BigInt helpers; 0.35.x uses isInt64/getInt64 instead.
      // The file lives in the root pnpm store (.pnpm/<pkg>/node_modules/...),
      // not in artifacts/hydrapulse/node_modules — scan the store directory.
      const patchHkBigInt = (swiftPath) => {
        if (!fs.existsSync(swiftPath)) return;
        let src = fs.readFileSync(swiftPath, "utf-8");
        if (!src.includes("isBigInt") && !src.includes("getBigInt")) return;
        src = src
          .replace(/anyMap\.isBigInt\(key:/g, "anyMap.isInt64(key:")
          .replace(/anyMap\.getBigInt\(key:/g, "anyMap.getInt64(key:");
        fs.writeFileSync(swiftPath, src);
      };
      // Try root pnpm store first (EAS Cloud layout)
      const pnpmStore = path.join(__dirname, "node_modules", ".pnpm");
      if (fs.existsSync(pnpmStore)) {
        const hkPrefix = "@kingstinct+react-native-healthkit@";
        for (const entry of fs.readdirSync(pnpmStore)) {
          if (!entry.startsWith(hkPrefix)) continue;
          patchHkBigInt(path.join(pnpmStore, entry, "node_modules", "@kingstinct", "react-native-healthkit", "ios", "QuantityTypeModule.swift"));
        }
      }
      // Fallback: direct path (local dev / hoisted layout)
      patchHkBigInt(path.join(root, "node_modules", "@kingstinct", "react-native-healthkit", "ios", "QuantityTypeModule.swift"));
      patchHkBigInt(path.join(__dirname, "node_modules", "@kingstinct", "react-native-healthkit", "ios", "QuantityTypeModule.swift"));

      // folly/coro/Coroutine.h stub in the iOS project dir
      const iosDir = modConfig.modRequest.platformProjectRoot;
      const stubCoroDir = path.join(iosDir, "FollyStubs", "folly", "coro");
      const stubCoroFile = path.join(stubCoroDir, "Coroutine.h");
      if (!fs.existsSync(stubCoroFile)) {
        fs.mkdirSync(stubCoroDir, { recursive: true });
        fs.writeFileSync(stubCoroFile, "#pragma once\n// HydraPulse: folly/coro/Coroutine.h stub\n");
      }

      return modConfig;
    },
  ]);
}

module.exports = ({ config }) => {
  const appConfig = {
    ...config,
    name: "HydraPulse",
    slug: "hydrapulse",
    version: "1.0.0",
    orientation: "portrait",
    // Absolute paths — correct regardless of prebuild working directory
    icon: path.join(HP, "assets", "images", "icon.png"),
    scheme: "hydrapulse",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    splash: {
      image: path.join(HP, "assets", "images", "icon.png"),
      resizeMode: "contain",
      backgroundColor: "#070D1A",
    },

    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.hydrapulse.app",
      buildNumber: "1",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription:
          "HydraPulse uses the rear camera and torch to illuminate your fingertip for PPG-based hydration estimation.",
        NSMicrophoneUsageDescription:
          "HydraPulse may use the microphone for voice-timbre hydration analysis in a future update.",
        UIBackgroundModes: ["remote-notification"],
      },
    },

    android: {
      package: "com.hydrapulse.app",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.FLASHLIGHT",
        "android.permission.RECORD_AUDIO",
        "android.permission.health.READ_HEART_RATE",
        "android.permission.health.READ_HEART_RATE_VARIABILITY",
        "android.permission.health.WRITE_NUTRITION",
      ],
    },

    web: {
      favicon: path.join(HP, "assets", "images", "icon.png"),
    },

    // Each plugin is required by absolute path from the hydrapulse node_modules
    // so resolution succeeds both on the developer's machine and on EAS Cloud.
    plugins: [
      hp("expo-dev-client"),
      [hp("expo-router"), { origin: "https://replit.com/" }],
      [
        hp("react-native-vision-camera"),
        {
          cameraPermissionText:
            "HydraPulse uses the rear camera and torch to illuminate your fingertip for PPG-based hydration estimation.",
          enableMicrophonePermission: false,
        },
      ],
      [
        hp("@kingstinct/react-native-healthkit"),
        {
          NSHealthShareUsageDescription:
            "HydraPulse reads heart rate and HRV data from Apple Health to enhance your hydration insights.",
          NSHealthUpdateUsageDescription:
            "HydraPulse saves hydration data to Apple Health for tracking over time.",
        },
      ],
      hp("expo-font"),
      hp("expo-web-browser"),
      [
        hp("expo-notifications"),
        {
          icon: path.join(HP, "assets", "images", "icon.png"),
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
        projectId: "15fd2666-3b4a-448c-bfe4-efedd1d70f44a",
      },
    },
  };

  let result = withNativeModulePodspecPatches(appConfig);
  result = withFollyNoCoroutines(result);
  result = withEntitlementsPlist(result, (cfg) => {
    cfg.modResults["com.apple.developer.healthkit"] = true;
    cfg.modResults["com.apple.developer.healthkit.background-delivery"] = true;
    return cfg;
  });

  return result;
};
