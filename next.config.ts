import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NIKAH_QA === "1" ? ".next-qa" : ".next",
};

export default nextConfig;
