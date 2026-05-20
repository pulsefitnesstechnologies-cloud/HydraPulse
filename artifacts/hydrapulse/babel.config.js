const path = require("path");

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      [
        "module-resolver",
        {
          root: [__dirname],
          alias: { "@": __dirname },
          extensions: [
            ".ios.ts",
            ".android.ts",
            ".ts",
            ".ios.tsx",
            ".android.tsx",
            ".tsx",
            ".js",
            ".jsx",
            ".json",
          ],
        },
      ],
      // Required for react-native-worklets-core frame processor worklets.
      // Must be listed before any other transform plugins.
      "react-native-worklets-core/plugin",

      // React Compiler optimisation — after worklets, before Reanimated.
      ["babel-plugin-react-compiler", { target: "19" }],

      // Reanimated — must always be last.
      "react-native-reanimated/plugin",
    ],
  };
};
