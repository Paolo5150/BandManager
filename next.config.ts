import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const configuredTunnelHost = process.env.CLOUDFLARE_TUNNEL_HOST?.trim();
const tunnelHosts = isDevelopment
  ? ["*.trycloudflare.com", ...(configuredTunnelHost ? [configuredTunnelHost] : [])]
  : [];

const nextConfig: NextConfig = {
  /* config options here */
  ...(isDevelopment ? { allowedDevOrigins: tunnelHosts } : {}),
  experimental: {
    agentFeedback: true,
    serverActions: {
      bodySizeLimit: "55mb",
      ...(isDevelopment ? { allowedOrigins: tunnelHosts } : {}),
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
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
