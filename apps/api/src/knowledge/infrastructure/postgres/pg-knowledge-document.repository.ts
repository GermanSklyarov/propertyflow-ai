import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateKnowledgeDocumentRequest,
  KnowledgeChunkSearchRequest,
  KnowledgeDocumentChunkSnapshot,
  KnowledgeDocumentKind,
  KnowledgeDocumentSearchRequest,
  KnowledgeDocumentSnapshot
} from "@propertyflow/contracts";
import type { Pool } from "pg";
import { PG_POOL } from "../../../database/database.constants.js";
import type { KnowledgeDocumentRepository } from "../../domain/knowledge-document.repository.js";

interface KnowledgeDocumentRow {
  id: string;
  tenant_id: string;
  title: string;
  body: string;
  locale: KnowledgeDocumentSnapshot["locale"];
  kind: KnowledgeDocumentKind;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

interface KnowledgeDocumentChunkRow {
  id: string;
  tenant_id: string;
  document_id: string;
  chunk_index: number;
  title: string;
  content: string;
  locale: KnowledgeDocumentSnapshot["locale"];
  kind: KnowledgeDocumentKind;
  tags: string[];
  token_estimate: number;
  score: number;
  embedding_status: KnowledgeDocumentChunkSnapshot["embeddingStatus"];
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PgKnowledgeDocumentRepository implements KnowledgeDocumentRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async save(tenantId: string, request: CreateKnowledgeDocumentRequest): Promise<KnowledgeDocumentSnapshot> {
    const now = new Date().toISOString();
    const result = await this.pool.query<KnowledgeDocumentRow>(
      `
        insert into knowledge_documents (
          id,
          tenant_id,
          title,
          body,
          locale,
          kind,
          tags,
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
          $9
        )
        returning *
      `,
      [
        crypto.randomUUID(),
        tenantId,
        request.title,
        request.body,
        request.locale,
        request.kind,
        request.tags ?? [],
        now,
        now
      ]
    );

    return this.toSnapshot(result.rows[0]);
  }

  async search(tenantId: string, request: KnowledgeDocumentSearchRequest): Promise<KnowledgeDocumentSnapshot[]> {
    const clauses = ["tenant_id = $1"];
    const values: unknown[] = [tenantId];
    const limit = Math.min(Math.max(request.limit ?? 20, 1), 50);

    const addValue = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    if (request.locale) {
      clauses.push(`locale = ${addValue(request.locale)}`);
    }

    if (request.kind) {
      clauses.push(`kind = ${addValue(request.kind)}`);
    }

    const terms = this.searchTerms(request.query);
    if (terms.length) {
      const termClauses = terms.map((term) => {
        const pattern = addValue(`%${term}%`);
        return `(title ilike ${pattern} or body ilike ${pattern} or exists (
          select 1 from unnest(tags) as tag where tag ilike ${pattern}
        ))`;
      });
      clauses.push(`(${termClauses.join(" or ")})`);
    }

    const result = await this.pool.query<KnowledgeDocumentRow>(
      `
        select *
        from knowledge_documents
        where ${clauses.join(" and ")}
        order by updated_at desc
        limit ${addValue(limit)}
      `,
      values
    );

    return result.rows.map((row) => this.toSnapshot(row));
  }

  async searchChunks(
    tenantId: string,
    request: KnowledgeChunkSearchRequest
  ): Promise<KnowledgeDocumentChunkSnapshot[]> {
    const clauses = ["tenant_id = $1"];
    const values: unknown[] = [tenantId];
    const limit = Math.min(Math.max(request.limit ?? 5, 1), 20);

    const addValue = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    if (request.locale) {
      clauses.push(`locale = ${addValue(request.locale)}`);
    }

    if (request.kind) {
      clauses.push(`kind = ${addValue(request.kind)}`);
    }

    const terms = this.searchTerms(request.query);
    const scoreParts: string[] = [];

    if (terms.length) {
      const termClauses = terms.map((term) => {
        const pattern = addValue(`%${term}%`);
        scoreParts.push(`
          case when title ilike ${pattern} then 4 else 0 end +
          case when content ilike ${pattern} then 2 else 0 end +
          case when exists (select 1 from unnest(tags) as tag where tag ilike ${pattern}) then 3 else 0 end
        `);

        return `(title ilike ${pattern} or content ilike ${pattern} or exists (
          select 1 from unnest(tags) as tag where tag ilike ${pattern}
        ))`;
      });
      clauses.push(`(${termClauses.join(" or ")})`);
    }

    const scoreExpression = scoreParts.length ? scoreParts.join(" + ") : "1";
    const result = await this.pool.query<KnowledgeDocumentChunkRow>(
      `
        select
          *,
          (${scoreExpression})::float as score
        from knowledge_document_chunks
        where ${clauses.join(" and ")}
        order by score desc, updated_at desc, chunk_index asc
        limit ${addValue(limit)}
      `,
      values
    );

    return result.rows.map((row) => this.toChunkSnapshot(row));
  }

  private searchTerms(query?: string): string[] {
    return (query ?? "")
      .toLowerCase()
      .replaceAll("ё", "е")
      .split(/[^a-zа-я0-9-]+/i)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3)
      .slice(0, 5);
  }

  private toSnapshot(row: KnowledgeDocumentRow): KnowledgeDocumentSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      body: row.body,
      locale: row.locale,
      kind: row.kind,
      tags: row.tags,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private toChunkSnapshot(row: KnowledgeDocumentChunkRow): KnowledgeDocumentChunkSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      documentId: row.document_id,
      chunkIndex: row.chunk_index,
      title: row.title,
      content: row.content,
      locale: row.locale,
      kind: row.kind,
      tags: row.tags,
      tokenEstimate: row.token_estimate,
      score: Number(row.score),
      embeddingStatus: row.embedding_status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }
}
