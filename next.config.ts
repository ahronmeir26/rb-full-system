import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.CLOUD_RUN_BUILD === "1" ? "standalone" : undefined,
  typescript: process.env.CLOUD_RUN_BUILD === "1"
    ? { tsconfigPath: "tsconfig.gcloud.json" }
    : undefined,
};

export default nextConfig;
