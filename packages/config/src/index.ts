export interface AppConfig {
  nodeEnv: string;
  apiPort: number;
  databaseUrl: string;
  redisUrl: string;
  opensearchUrl: string;
  s3Endpoint: string;
}

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    nodeEnv: env.NODE_ENV ?? "development",
    apiPort: Number(env.API_PORT ?? 3001),
    databaseUrl: requireEnv(env, "DATABASE_URL"),
    redisUrl: requireEnv(env, "REDIS_URL"),
    opensearchUrl: requireEnv(env, "OPENSEARCH_URL"),
    s3Endpoint: requireEnv(env, "S3_ENDPOINT")
  };
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

