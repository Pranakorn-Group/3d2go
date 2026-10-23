import type { NextConfig } from "next";

// Cache Components is off on purpose: every backstore page reads live stock data behind a login,
// so plain request-time rendering is simpler and always fresh.
const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
