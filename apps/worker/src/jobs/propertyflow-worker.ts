import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { Client } from "@opensearch-project/opensearch";
import { Pool } from "pg";
import {
  type BackgroundJobName,
  type BackgroundJobPayload,
  type ConciergeModelTrainJobPayload,
  type KnowledgeChunkEmbeddingJobPayload,
  type KnowledgeDocumentIngestJobPayload,
  type PricingModelTrainJobPayload,
  type PropertySearchRequest,
  type PropertyAiDescriptionJobPayload,
  type PropertyImageAnalysisJobPayload,
  type PropertyImportJobPayload,
  type PropertySearchIndexJobPayload,
  type SavedSearchAlertDigestJobPayload,
  PROPERTYFLOW_JOBS_QUEUE
} from "@propertyflow/contracts";
import { loadAppConfig } from "@propertyflow/config";
import { PropertyAiOutputWriter } from "./property-ai-output-writer.js";
import { PropertySearchIndexer } from "./property-search-indexer.js";

type PropertyflowJob = Job<BackgroundJobPayload, unknown, BackgroundJobName>;
type ConciergeModelTrainJob = Job<ConciergeModelTrainJobPayload, unknown, "concierge.model.train">;
type KnowledgeChunkEmbeddingJob = Job<
  KnowledgeChunkEmbeddingJobPayload,
  unknown,
  "knowledge.chunks.embed"
>;
type KnowledgeDocumentIngestJob = Job<
  KnowledgeDocumentIngestJobPayload,
  unknown,
  "knowledge.documents.ingest"
>;
type PricingModelTrainJob = Job<PricingModelTrainJobPayload, unknown, "pricing.model.train">;
type PropertyImportJob = Job<PropertyImportJobPayload, unknown, "properties.import">;
type PropertyAiDescriptionJob = Job<
  PropertyAiDescriptionJobPayload,
  unknown,
  "properties.ai_description.generate"
>;
type PropertyImageAnalysisJob = Job<PropertyImageAnalysisJobPayload, unknown, "properties.images.analyze">;
type PropertySearchIndexJob = Job<PropertySearchIndexJobPayload, unknown, "properties.search.index">;
type SavedSearchAlertDigestJob = Job<SavedSearchAlertDigestJobPayload, unknown, "saved_search.alerts.digest">;

interface SavedSearchAlertRow {
  id: string;
  title: string;
  filters: PropertySearchRequest;
}

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
      case "concierge.model.train":
        return this.trainConciergeModel(job as ConciergeModelTrainJob);
      case "knowledge.chunks.embed":
        return this.embedKnowledgeChunks(job as KnowledgeChunkEmbeddingJob);
      case "knowledge.documents.ingest":
        return this.ingestKnowledgeDocument(job as KnowledgeDocumentIngestJob);
      case "pricing.model.train":
        return this.trainPricingModel(job as PricingModelTrainJob);
      case "properties.import":
        return this.importProperties(job as PropertyImportJob);
      case "properties.ai_description.generate":
        return this.generatePropertyDescription(job as PropertyAiDescriptionJob);
      case "properties.images.analyze":
        return this.analyzePropertyImages(job as PropertyImageAnalysisJob);
      case "saved_search.alerts.digest":
        return this.buildSavedSearchAlertDigest(job as SavedSearchAlertDigestJob);
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

  private async ingestKnowledgeDocument(job: KnowledgeDocumentIngestJob): Promise<Record<string, unknown>> {
    const documentResult = await this.pool.query<{
      id: string;
      tenant_id: string;
      title: string;
      body: string;
      locale: string;
      kind: string;
      tags: string[];
    }>(
      `
        select id, tenant_id, title, body, locale, kind, tags
        from knowledge_documents
        where tenant_id = $1 and id = $2
      `,
      [job.data.tenantId, job.data.documentId]
    );
    const document = documentResult.rows[0];

    if (!document) {
      return {
        tenantId: job.data.tenantId,
        documentId: job.data.documentId,
        reason: job.data.reason,
        ingested: false,
        status: "document-not-found"
      };
    }

    const now = new Date().toISOString();
    const chunks = this.chunkKnowledgeDocument(document.title, document.body);
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      await client.query(
        `
          delete from knowledge_document_chunks
          where tenant_id = $1 and document_id = $2
        `,
        [job.data.tenantId, job.data.documentId]
      );

      for (const [index, chunk] of chunks.entries()) {
        await client.query(
          `
            insert into knowledge_document_chunks (
              id,
              tenant_id,
              document_id,
              chunk_index,
              title,
              content,
              locale,
              kind,
              tags,
              token_estimate,
              search_text,
              embedding_model,
              embedding_status,
              created_at,
              updated_at
            ) values (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              $12,
              $13,
              $14,
              $15
            )
          `,
          [
            crypto.randomUUID(),
            job.data.tenantId,
            job.data.documentId,
            index,
            document.title,
            chunk,
            document.locale,
            document.kind,
            document.tags,
            this.estimateTokens(chunk),
            this.buildKnowledgeSearchText(document.title, chunk, document.tags),
            "pending-embedding-provider",
            "pending",
            now,
            now
          ]
        );
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    return {
      tenantId: job.data.tenantId,
      documentId: job.data.documentId,
      reason: job.data.reason,
      ingested: true,
      chunks: chunks.length,
      embeddingStatus: "pending"
    };
  }

  private async embedKnowledgeChunks(job: KnowledgeChunkEmbeddingJob): Promise<Record<string, unknown>> {
    const clauses = ["tenant_id = $1", "embedding_status in ('pending', 'failed')"];
    const values: unknown[] = [job.data.tenantId];
    const addValue = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    if (job.data.documentId) {
      clauses.push(`document_id = ${addValue(job.data.documentId)}`);
    }

    const limit = Math.min(Math.max(job.data.limit ?? 100, 1), 500);
    const chunks = await this.pool.query<{
      id: string;
      title: string;
      content: string;
      tags: string[];
    }>(
      `
        select id, title, content, tags
        from knowledge_document_chunks
        where ${clauses.join(" and ")}
        order by updated_at asc, chunk_index asc
        limit ${addValue(limit)}
      `,
      values
    );

    let embedded = 0;
    let failed = 0;
    const now = new Date().toISOString();

    for (const chunk of chunks.rows) {
      try {
        const vector = this.embedText(
          [chunk.title, chunk.content, chunk.tags.join(" ")].join(" "),
          job.data.dimensions
        );

        await this.pool.query(
          `
            update knowledge_document_chunks
            set
              embedding = $1,
              embedding_model = $2,
              embedding_status = 'embedded',
              updated_at = $3
            where tenant_id = $4 and id = $5
          `,
          [vector, `${job.data.provider}:${job.data.model}`, now, job.data.tenantId, chunk.id]
        );
        embedded += 1;
      } catch {
        await this.pool.query(
          `
            update knowledge_document_chunks
            set embedding_status = 'failed', updated_at = $1
            where tenant_id = $2 and id = $3
          `,
          [now, job.data.tenantId, chunk.id]
        );
        failed += 1;
      }
    }

    return {
      tenantId: job.data.tenantId,
      documentId: job.data.documentId,
      provider: job.data.provider,
      model: job.data.model,
      dimensions: job.data.dimensions,
      scanned: chunks.rowCount,
      embedded,
      failed
    };
  }

  private async trainPricingModel(job: PricingModelTrainJob): Promise<Record<string, unknown>> {
    const result = await this.pool.query<{ count: string }>(
      `
        select count(*) as count
        from property_price_recommendation_feedback
        where tenant_id = $1
      `,
      [job.data.tenantId]
    );
    const sampleSize = Number(result.rows[0]?.count ?? 0);

    return {
      tenantId: job.data.tenantId,
      modelVersion: job.data.modelVersion,
      algorithm: job.data.algorithm,
      dryRun: job.data.dryRun ?? false,
      sampleSize,
      trained: false,
      status: sampleSize > 0 ? "dataset-ready" : "insufficient-data"
    };
  }

  private async trainConciergeModel(job: ConciergeModelTrainJob): Promise<Record<string, unknown>> {
    const result = await this.pool.query<{
      total: string;
      positive_feedback: string;
      converted_leads: string;
      selected_properties: string;
    }>(
      `
        select
          count(distinct session.id) as total,
          count(distinct session.id) filter (where feedback.rating = 'positive') as positive_feedback,
          count(distinct session.id) filter (where lead.id is not null) as converted_leads,
          count(distinct session.id) filter (where feedback.selected_property_id is not null) as selected_properties
        from concierge_sessions session
        left join lateral (
          select *
          from concierge_feedback feedback
          where feedback.tenant_id = session.tenant_id
            and feedback.session_id = session.id
          order by feedback.created_at desc
          limit 1
        ) feedback on true
        left join leads lead
          on lead.tenant_id = session.tenant_id
          and lead.source = 'ai-concierge'
          and lead.attribution_search_event_id = session.id
        where session.tenant_id = $1
      `,
      [job.data.tenantId]
    );
    const row = result.rows[0];
    const sampleSize = Number(row?.total ?? 0);
    const positiveFeedback = Number(row?.positive_feedback ?? 0);
    const convertedLeads = Number(row?.converted_leads ?? 0);
    const selectedProperties = Number(row?.selected_properties ?? 0);

    return {
      tenantId: job.data.tenantId,
      modelVersion: job.data.modelVersion,
      algorithm: job.data.algorithm,
      dryRun: job.data.dryRun ?? false,
      sampleSize,
      labels: {
        positiveFeedback,
        convertedLeads,
        selectedProperties
      },
      trained: false,
      status: sampleSize >= 10 && (positiveFeedback > 0 || convertedLeads > 0) ? "dataset-ready" : "insufficient-data"
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

  private async buildSavedSearchAlertDigest(job: SavedSearchAlertDigestJob): Promise<Record<string, unknown>> {
    const clauses = ["tenant_id = $1", "notifications_enabled = true"];
    const values: unknown[] = [job.data.tenantId];
    const addValue = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    if (job.data.scope === "user") {
      clauses.push(`user_id = ${addValue(job.data.userId)}`);
    }

    const limit = Math.min(Math.max(job.data.limit ?? 50, 1), 100);
    const searches = await this.pool.query<SavedSearchAlertRow>(
      `
        select id, title, filters
        from saved_property_searches
        where ${clauses.join(" and ")}
        order by updated_at desc
        limit ${addValue(limit)}
      `,
      values
    );

    let totalCandidates = 0;
    const items = [];

    for (const search of searches.rows) {
      const currentMatchCount = await this.countPropertyMatches(job.data.tenantId, search.filters);
      totalCandidates += currentMatchCount;
      items.push({
        savedSearchId: search.id,
        title: search.title,
        currentMatchCount
      });
    }

    return {
      tenantId: job.data.tenantId,
      scope: job.data.scope,
      userId: job.data.userId,
      dryRun: job.data.dryRun ?? true,
      totalAlerts: items.length,
      totalCandidates,
      items,
      delivered: job.data.dryRun === false ? 0 : undefined,
      generatedAt: new Date().toISOString()
    };
  }

  private async countPropertyMatches(tenantId: string, filters: PropertySearchRequest): Promise<number> {
    const clauses = ["tenant_id = $1"];
    const values: unknown[] = [tenantId];
    const addValue = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    if (filters.market) {
      clauses.push(`market = ${addValue(filters.market)}`);
    }

    if (filters.minPriceThb !== undefined) {
      clauses.push(`price_currency = 'THB' and price_amount >= ${addValue(filters.minPriceThb)}`);
    }

    if (filters.maxPriceThb !== undefined) {
      clauses.push(`price_currency = 'THB' and price_amount <= ${addValue(filters.maxPriceThb)}`);
    }

    if (filters.minBedrooms !== undefined) {
      clauses.push(`bedrooms >= ${addValue(filters.minBedrooms)}`);
    }

    if (filters.minBathrooms !== undefined) {
      clauses.push(`bathrooms >= ${addValue(filters.minBathrooms)}`);
    }

    if (filters.minAreaSqm !== undefined) {
      clauses.push(`area_sqm >= ${addValue(filters.minAreaSqm)}`);
    }

    if (filters.maxBeachDistanceMeters !== undefined) {
      clauses.push(`beach_distance_meters <= ${addValue(filters.maxBeachDistanceMeters)}`);
    }

    if (filters.requiredAmenities?.length) {
      clauses.push(`amenities @> ${addValue(filters.requiredAmenities)}::text[]`);
    }

    if (filters.near && filters.radiusMeters !== undefined) {
      const longitude = addValue(filters.near.longitude);
      const latitude = addValue(filters.near.latitude);
      const radius = addValue(filters.radiusMeters);
      clauses.push(`st_dwithin(location, st_setsrid(st_makepoint(${longitude}, ${latitude}), 4326)::geography, ${radius})`);
    }

    const result = await this.pool.query<{ count: string }>(
      `
        select count(*) as count
        from properties
        where ${clauses.join(" and ")}
      `,
      values
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  private chunkKnowledgeDocument(title: string, body: string): string[] {
    const paragraphs = body
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const chunks: string[] = [];
    let current = "";
    const maxCharacters = 900;

    for (const paragraph of paragraphs.length ? paragraphs : [body.replace(/\s+/g, " ").trim()]) {
      if (!paragraph) {
        continue;
      }

      const next = current ? `${current}\n\n${paragraph}` : paragraph;
      if (next.length <= maxCharacters) {
        current = next;
        continue;
      }

      if (current) {
        chunks.push(current);
      }

      if (paragraph.length <= maxCharacters) {
        current = paragraph;
        continue;
      }

      for (let offset = 0; offset < paragraph.length; offset += maxCharacters) {
        chunks.push(paragraph.slice(offset, offset + maxCharacters));
      }
      current = "";
    }

    if (current) {
      chunks.push(current);
    }

    return chunks.length ? chunks : [title];
  }

  private estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  private buildKnowledgeSearchText(title: string, chunk: string, tags: string[]): string {
    return [title, chunk, tags.join(" ")].join(" ").toLowerCase().replaceAll("ё", "е");
  }

  private embedText(text: string, dimensions: number): number[] {
    const vector = Array.from({ length: dimensions }, () => 0);
    const tokens = text
      .toLowerCase()
      .replaceAll("ё", "е")
      .split(/[^a-zа-я0-9-]+/i)
      .map((token) => token.trim())
      .filter(Boolean);

    for (const token of tokens.length ? tokens : [text]) {
      const hash = this.hashToken(token);
      const index = Math.abs(hash) % dimensions;
      vector[index] += hash < 0 ? -1 : 1;
    }

    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => Number((value / magnitude).toFixed(6)));
  }

  private hashToken(token: string): number {
    let hash = 0;

    for (let index = 0; index < token.length; index += 1) {
      hash = (hash * 31 + token.charCodeAt(index)) | 0;
    }

    return hash;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported job name: ${String(value)}`);
}
