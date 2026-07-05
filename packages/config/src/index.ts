import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

export interface AppConfig {
  nodeEnv: string;
  apiPort: number;
  databaseUrl: string;
  redisUrl: string;
  opensearchUrl: string;
  s3Endpoint: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3Bucket: string;
}

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const envPath = findEnvFile(process.cwd());

  dotenv.config(envPath ? { path: envPath } : undefined);

  return {
    nodeEnv: env.NODE_ENV ?? "development",
    apiPort: Number(env.API_PORT ?? 3001),
    databaseUrl: requireEnv(env, "DATABASE_URL"),
    redisUrl: requireEnv(env, "REDIS_URL"),
    opensearchUrl: requireEnv(env, "OPENSEARCH_URL"),
    s3Endpoint: requireEnv(env, "S3_ENDPOINT"),
    s3AccessKey: requireEnv(env, "S3_ACCESS_KEY"),
    s3SecretKey: requireEnv(env, "S3_SECRET_KEY"),
    s3Bucket: requireEnv(env, "S3_BUCKET")
  };
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function findEnvFile(startDir: string): string | undefined {
  let currentDir = startDir;

  while (true) {
    const candidate = join(currentDir, ".env");

    if (existsSync(candidate)) {
      return candidate;
    }

    const parentDir = dirname(currentDir);

    if (parentDir === currentDir) {
      return undefined;
    }

    currentDir = parentDir;
  }
}
