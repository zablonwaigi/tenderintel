/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  eslint: {
    // Pipeline scripts and generated content shouldn't block production builds.
    ignoreDuringBuilds: true,
  },
  experimental: {
    // pdf-parse / mammoth / xlsx are Node-only; keep them external on the server.
    serverComponentsExternalPackages: ["pdf-parse", "mammoth", "xlsx", "p-limit"],
  },
};

export default nextConfig;
