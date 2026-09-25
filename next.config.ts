import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Root AGENTS.md/CLAUDE.md are the source of truth for this monorepo;
  // don't let Next.js generate duplicates inside apps/web.
  agentRules: false,
  // Minimal, self-contained runtime output for the Docker image.
  output: "standalone",
};

export default nextConfig;
