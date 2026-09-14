import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image optimization cache writes get corrupted on this project's
  // exFAT-formatted drive, so serve local images unprocessed.
  images: {
    unoptimized: true,
  },
  experimental: {
    // Turbopack's on-disk dev cache also corrupts on exFAT
    // ("Failed to open database" on restart) — keep it in memory only.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
