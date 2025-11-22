import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors secretmovieappprotocol: https://tamovieapp.onrender.com 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
