/** @type {import("next").NextConfig} */
const nextConfig = {
  agentRules: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb"
    }
  },
  typedRoutes: true
};

export default nextConfig;
