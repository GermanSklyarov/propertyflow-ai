/** @type {import("next").NextConfig} */
const nextConfig = {
  agentRules: false,
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb"
    }
  },
  typedRoutes: true
};

export default nextConfig;
