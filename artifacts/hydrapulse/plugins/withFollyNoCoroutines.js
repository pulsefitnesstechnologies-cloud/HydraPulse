// Config plugin: inject FOLLY_CFG_NO_COROUTINES=1 globally into the Podfile.
//
// Why this is needed:
//   Folly auto-detects C++20 coroutine support using __has_include / compiler
//   feature macros. When any native pod includes a Folly header (even indirectly
//   through React Native), Folly may attempt to pull in folly/coro/Coroutine.h.
//   That header is not present in the Folly bundle shipped with React Native,
//   which causes the build to fail with "'folly/coro/Coroutine.h' file not found".
//
//   Setting FOLLY_CFG_NO_COROUTINES=1 tells Folly to skip coroutines entirely,
//   regardless of compiler capability. This is the same flag used by
//   react-native-worklets-core, vision-camera-resize-plugin, and
//   @kingstinct/react-native-healthkit in their own podspecs — but we need it
//   applied globally so it takes effect before any Folly header is evaluated.
//
// Reference: https://github.com/nicolo-ribaudo/tc39-proposal-optional-chaining-assignment/issues

const { withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const HOOK = `
# ─── HydraPulse: Folly coroutines fix ────────────────────────────────────────
# Globally disables Folly's C++20 coroutine auto-detection across all pods.
# Prevents 'folly/coro/Coroutine.h' file not found build errors.
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      defs = Array(config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'])
      defs |= ['$(inherited)', 'FOLLY_NO_CONFIG=1', 'FOLLY_CFG_NO_COROUTINES=1']
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
    end
  end
end
# ─────────────────────────────────────────────────────────────────────────────
`;

/** @type {import('@expo/config-plugins').ConfigPlugin} */
function withFollyNoCoroutines(config) {
  return withDangerousMod(config, [
    "ios",
    (modConfig) => {
      const podfilePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        "Podfile"
      );

      if (!fs.existsSync(podfilePath)) {
        console.warn("[withFollyNoCoroutines] Podfile not found, skipping.");
        return modConfig;
      }

      const contents = fs.readFileSync(podfilePath, "utf-8");

      // Idempotent: don't append twice
      if (contents.includes("FOLLY_CFG_NO_COROUTINES")) {
        return modConfig;
      }

      fs.writeFileSync(podfilePath, contents + HOOK);
      return modConfig;
    },
  ]);
}

module.exports = withFollyNoCoroutines;
