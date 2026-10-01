import { execSync } from "child_process";
import type { NextConfig } from "next";

// Short commit ID of the code being built, shown in the corner of the site so you can see which
// version is live. Vercel provides VERCEL_GIT_COMMIT_SHA at build time; locally we ask git.
function commitId(): string {
  const vercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercel) return vercel.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    APP_COMMIT_ID: commitId(),
  },
};

export default nextConfig;
