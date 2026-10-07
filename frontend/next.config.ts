import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://127.0.0.1:8100/api/:path*" },
      { source: "/health", destination: "http://127.0.0.1:8100/health" },
      { source: "/ws", destination: "http://127.0.0.1:8100/ws" },
      { source: "/ws/:path*", destination: "http://127.0.0.1:8100/ws/:path*" },
    ];
  },
};

export default nextConfig;
