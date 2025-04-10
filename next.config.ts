import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        source: "/api/ws",
        headers: [
          {
            key: "Upgrade",
            value: "websocket",
          },
          {
            key: "Connection",
            value: "Upgrade",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
