import { NextConfig } from "next";

const nextConfig : NextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  // Add this for better error reporting
  productionBrowserSourceMaps: false,
  // Disable static optimization temporarily to debug

  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatar.iran.liara.run",
      },
      {
        protocol: "https",
        hostname: "flagcdn.com",
      },
    ],
  },
};

export default nextConfig;
