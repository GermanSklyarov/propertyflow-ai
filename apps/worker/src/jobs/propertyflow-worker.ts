import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { Client } from "@opensearch-project/opensearch";
import { Pool } from "pg";
import {
  type BackgroundJobName,
  type BackgroundJobPayload,
  type PropertyAiDescriptionJobPayload,
  type PropertyImageAnalysisJobPayload,
  type PropertyImportJobPayload,
  type PropertySearchIndexJobPayload,
  PROPERTYFLOW_JOBS_QUEUE
} from "@propertyflow/contracts";
import { loadAppConfig } from "@propertyflow/config";
import { PropertyAiOutputWriter } from "./property-ai-output-writer.js";
import { PropertySearchIndexer } from "./property-search-indexer.js";

type PropertyflowJob = Job<BackgroundJobPayload, unknown, BackgroundJobName>;
type PropertyImportJob = Job<PropertyImportJobPayload, unknown, "properties.import">;
type PropertyAiDescriptionJob = Job<
  PropertyAiDescriptionJobPayload,
  unknown,
  "properties.ai_description.generate"
>;
type PropertyImageAnalysisJob = Job<PropertyImageAnalysisJobPayload, unknown, "properties.images.analyze">;
type PropertySearchIndexJob = Job<PropertySearchIndexJobPayload, unknown, "properties.search.index">;

export class PropertyflowWorker {
  private readonly pool: Pool;
  private readonly aiOutputWriter: PropertyAiOutputWriter;
  private readonly searchIndexer: PropertySearchIndexer;
  private readonly connection: Redis;
  private readonly worker: Worker<BackgroundJobPayload, unknown, BackgroundJobName>;

  constructor() {
    const config = loadAppConfig();

    this.pool = new Pool({
      connectionString: config.databaseUrl,
      max: 5
    });

    this.aiOutputWriter = new PropertyAiOutputWriter(this.pool);

    this.searchIndexer = new PropertySearchIndexer(
      this.pool,
      new Client({
        node: config.opensearchUrl
      })
    );

    this.connection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null
    });

    this.worker = new Worker<BackgroundJobPayload, unknown, BackgroundJobName>(
      PROPERTYFLOW_JOBS_QUEUE,
      (job) => this.process(job),
      {
        connection: this.connection,
        concurrency: 5
      }
    );

    this.worker.on("completed", (job) => {
      console.log(`[jobs] completed ${job.name}#${job.id}`);
    });

    this.worker.on("failed", (job, error) => {
      console.error(`[jobs] failed ${job?.name ?? "unknown"}#${job?.id ?? "unknown"}`, error);
    });
  }

  async waitUntilReady(): Promise<void> {
    await this.worker.waitUntilReady();
  }

  async close(): Promise<void> {
    await this.worker.close();
    await this.pool.end();
    this.connection.disconnect();
  }

  private async process(job: PropertyflowJob): Promise<Record<string, unknown>> {
    console.log(`[jobs] processing ${job.name}#${job.id} for tenant ${job.data.tenantId}`);

    switch (job.name) {
      case "properties.import":
        return this.importProperties(job as PropertyImportJob);
      case "properties.ai_description.generate":
        return this.generatePropertyDescription(job as PropertyAiDescriptionJob);
      case "properties.images.analyze":
        return this.analyzePropertyImages(job as PropertyImageAnalysisJob);
      case "properties.search.index":
        return this.indexProperty(job as PropertySearchIndexJob);
      default:
        return assertNever(job.name);
    }
  }

  private async importProperties(job: PropertyImportJob): Promise<Record<string, unknown>> {
    return {
      tenantId: job.data.tenantId,
      source: job.data.source,
      dryRun: job.data.dryRun ?? false,
      imported: 0,
      skipped: 0
    };
  }

  private async generatePropertyDescription(job: PropertyAiDescriptionJob): Promise<Record<string, unknown>> {
    const generatedDescriptions = await this.aiOutputWriter.saveGeneratedDescriptions(job.data);

    return {
      tenantId: job.data.tenantId,
      propertyId: job.data.propertyId,
      locales: job.data.locales,
      generatedDescriptions
    };
  }

  private async analyzePropertyImages(job: PropertyImageAnalysisJob): Promise<Record<string, unknown>> {
    const analyzedImages = await this.aiOutputWriter.saveImageAnalysis(job.data);

    return {
      tenantId: job.data.tenantId,
      propertyId: job.data.propertyId,
      analyzedImages,
      detectedSignals: ["furnished", "air-conditioning"]
    };
  }

  private async indexProperty(job: PropertySearchIndexJob): Promise<Record<string, unknown>> {
    const document = await this.searchIndexer.indexProperty(job.data.tenantId, job.data.propertyId);

    return {
      tenantId: job.data.tenantId,
      propertyId: job.data.propertyId,
      reason: job.data.reason,
      index: "propertyflow-properties-v1",
      indexed: true,
      searchableTextLength: document.searchableText.length
    };
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported job name: ${String(value)}`);
}
