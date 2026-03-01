import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  transpilePackages: ["@pierre/diffs"],
  webpack: (config) => {
    // Fix for @pierre/diffs exports resolution
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path");
    config.resolve.alias["@pierre/diffs/react"] = path.resolve(
      __dirname,
      "node_modules/@pierre/diffs/dist/react/index.js"
    );
    config.resolve.alias["@pierre/diffs"] = path.resolve(
      __dirname,
      "node_modules/@pierre/diffs/dist/index.js"
    );
    return config;
  },
};

export default nextConfig;
