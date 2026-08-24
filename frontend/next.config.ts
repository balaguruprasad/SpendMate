import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Emit a self-contained server (.next/standalone) so the Docker image ships
  // only the files needed to run — required for the Cloud Run deploy.
  output: "standalone",
};

export default nextConfig;
