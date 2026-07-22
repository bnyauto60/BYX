/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "50mb" } // photos + vidéos d'inspection
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }]
  }
};

module.exports = nextConfig;
