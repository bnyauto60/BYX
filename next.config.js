/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true
  },
  experimental: {
    serverActions: { bodySizeLimit: "50mb" }
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }]
  }
};

module.exports = nextConfig;
