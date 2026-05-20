const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

config.resolver.alias = {
  "@": projectRoot,
};

// Exclude Replit-internal directories from Metro's file watcher so it
// doesn't crash on missing paths inside .local/skills/*, .git/*, etc.
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
config.resolver.blockList = [
  new RegExp(`^${escape(monorepoRoot)}/\\.local/.*`),
  new RegExp(`^${escape(monorepoRoot)}/\\.git/.*`),
];

module.exports = config;
