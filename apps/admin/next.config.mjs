import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const appDir = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = join(appDir, "../../.env");

if (existsSync(rootEnvPath)) {
  loadEnv({ path: rootEnvPath, quiet: true });
}

/** @type {import("next").NextConfig} */
const nextConfig = {
  agentRules: false,
  typedRoutes: true
};

export default nextConfig;
