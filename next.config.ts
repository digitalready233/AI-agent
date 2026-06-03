import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["ai", "@ai-sdk/react", "@ai-sdk/ui-utils"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  // If dev hits ENOENT on `.next/cache/webpack/**.pack.gz`, set DISABLE_WEBPACK_DEV_CACHE=1
  // in .env.local — disables webpack cache (slower dev compiles, fewer cache corruption errors).
  webpack: (config, { dev }) => {
    if (dev && process.env.DISABLE_WEBPACK_DEV_CACHE === "1") {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
