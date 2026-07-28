import { Pool } from "pg";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import {
  type BackgroundJobName,
  type BackgroundJobPayload,
  PROPERTYFLOW_JOBS_QUEUE
} from "@propertyflow/contracts";
import { loadAppConfig } from "@propertyflow/config";
import { defaultKnowledgeEmbeddingConfig } from "@propertyflow/domain";

const config = loadAppConfig();
const tenantId = process.env.SEED_TENANT_ID ?? "demo-agency";
const requestedByUserId = process.env.SEED_REQUESTED_BY_USER_ID ?? "manager-demo-1";
const limit = Math.min(Math.max(Number(process.env.SEED_DEMO_EMBEDDINGS_LIMIT ?? 500), 1), 500);
const timeoutMs = Number(process.env.SEED_DEMO_EMBEDDINGS_TIMEOUT_MS ?? 60_000);
const waitForWorker = process.env.SEED_DEMO_EMBEDDINGS_WAIT !== "false";
const embeddingConfig = defaultKnowledgeEmbeddingConfig();

if (embeddingConfig.provider !== "local-hash" && !embeddingConfig.apiKey) {
  throw new Error(
    `${embeddingConfig.provider} embeddings are selected, but the matching API key is missing. ` +
      "Set GEMINI_API_KEY or OPENAI_API_KEY, or leave AI_EMBEDDING_PROVIDER empty for local-hash dev fallback."
  );
}

const pool = new Pool({
  connectionString: config.databaseUrl
});
const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null
});
const queue = new Queue<BackgroundJobPayload, unknown, BackgroundJobName>(PROPERTYFLOW_JOBS_QUEUE, {
  connection: redis
});

try {
  await ensureTenantExists();
  const before = await getEmbeddingHealth();

  const job = await queue.add("knowledge.chunks.embed", {
    tenantId,
    requestedByUserId,
    provider: embeddingConfig.provider,
    model: embeddingConfig.model,
    dimensions: embeddingConfig.dimensions,
    limit,
    refreshExisting: true
  });

  console.log(
    [
      `[seed:demo-embeddings] queued job ${job.id}`,
      `tenant=${tenantId}`,
      `provider=${embeddingConfig.provider}`,
      `model=${embeddingConfig.model}`,
      `dimensions=${embeddingConfig.dimensions}`,
      `before=${formatHealth(before)}`
    ].join(" ")
  );

  if (waitForWorker) {
    const finalHealth = await waitForEmbeddingHealth();
    console.log(`[seed:demo-embeddings] ready ${formatHealth(finalHealth)}`);
  } else {
    console.log("[seed:demo-embeddings] not waiting for worker because SEED_DEMO_EMBEDDINGS_WAIT=false");
  }
} finally {
  await queue.close();
  await redis.quit();
  await pool.end();
}

async function ensureTenantExists() {
  const result = await pool.query("select id from tenants where id = $1 limit 1", [tenantId]);

  if (!result.rows[0]) {
    throw new Error(`Tenant "${tenantId}" does not exist. Run npm run seed:demo first.`);
  }
}

async function waitForEmbeddingHealth(): Promise<EmbeddingHealth> {
  const startedAt = Date.now();
  let lastHealth = await getEmbeddingHealth();

  while (Date.now() - startedAt < timeoutMs) {
    if (lastHealth.pending === 0 && lastHealth.failed === 0 && lastHealth.stale === 0 && lastHealth.current > 0) {
      return lastHealth;
    }

    await sleep(2_000);
    lastHealth = await getEmbeddingHealth();
    console.log(`[seed:demo-embeddings] waiting ${formatHealth(lastHealth)}`);
  }

  throw new Error(
    `Knowledge chunks were not embedded within ${timeoutMs}ms (${formatHealth(lastHealth)}). ` +
      "Is npm run dev:worker or npm run dev running?"
  );
}

type EmbeddingHealth = {
  current: number;
  stale: number;
  pending: number;
  failed: number;
  total: number;
};

async function getEmbeddingHealth(): Promise<EmbeddingHealth> {
  const targetModelKey = `${embeddingConfig.provider}:${embeddingConfig.model}`;
  const result = await pool.query<{
    current: string;
    stale: string;
    pending: string;
    failed: string;
    total: string;
  }>(
    `
      select
        count(*) filter (where embedding_status = 'embedded' and embedding_model = $2) as current,
        count(*) filter (where embedding_status = 'embedded' and embedding_model is distinct from $2) as stale,
        count(*) filter (where embedding_status = 'pending') as pending,
        count(*) filter (where embedding_status = 'failed') as failed,
        count(*) as total
      from knowledge_document_chunks
      where tenant_id = $1
    `,
    [tenantId, targetModelKey]
  );
  const row = result.rows[0];

  return {
    current: Number(row?.current ?? 0),
    stale: Number(row?.stale ?? 0),
    pending: Number(row?.pending ?? 0),
    failed: Number(row?.failed ?? 0),
    total: Number(row?.total ?? 0)
  };
}

function formatHealth(health: EmbeddingHealth): string {
  return `current=${health.current}/${health.total}, stale=${health.stale}, pending=${health.pending}, failed=${health.failed}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
