import type { Job } from "bullmq";
import type { Pool, PoolClient } from "pg";
import type {
  ListingSourceCanonicalField,
  ListingSourceCustomAttributeMapping,
  ListingSourceCustomAttributeType,
  ListingSourceFieldMapping,
  PropertyImportJobPayload
} from "@propertyflow/contracts";
import {
  KnowledgeEmbeddingGenerator,
  type PropertyKind,
  type PropertyListingType,
  type PropertyProjectStatus,
  type PropertyStatus,
  type ThailandMarket
} from "@propertyflow/domain";

type PropertyImportJob = Job<PropertyImportJobPayload, unknown, "properties.import">;
type PropertyImportMode = NonNullable<PropertyImportJobPayload["importMode"]>;
type PartnerFeedSource = Extract<PropertyImportJobPayload["source"], "partner-api" | "partner-xml">;

const supportedMarkets = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"] as const;
const supportedKinds = ["condo", "villa", "townhouse", "land", "commercial"] as const;
const supportedListingTypes = ["sale", "rent", "sale_or_rent"] as const;
const supportedProjectStatuses = ["planned", "under_construction", "completed", "paused"] as const;
const supportedPropertyStatuses = ["draft", "available", "reserved", "sold", "rented", "archived"] as const;

const marketCoordinates = {
  pattaya: { latitude: 12.9236, longitude: 100.8825 },
  phuket: { latitude: 7.8804, longitude: 98.3923 },
  bangkok: { latitude: 13.7563, longitude: 100.5018 },
  "hua-hin": { latitude: 12.5684, longitude: 99.9577 },
  "koh-samui": { latitude: 9.512, longitude: 100.0136 }
} satisfies Record<ThailandMarket, { latitude: number; longitude: number }>;

interface ImportedPropertyDraft {
  address?: string;
  amenities: string[];
  areaSqm: number;
  availableFrom?: string;
  availableUntil?: string;
  bathrooms: number;
  beachDistanceMeters?: number;
  bedrooms: number;
  customAttributes: ImportedCustomAttribute[];
  description?: string;
  externalId?: string;
  floor?: number;
  foreignQuota?: string;
  kind: PropertyKind;
  latitude?: number;
  listingType: PropertyListingType;
  longitude?: number;
  maintenanceFeeMonthlyThb?: number;
  market: ThailandMarket;
  minimumRentalMonths?: number;
  monthlyRentEstimateThb?: number;
  priceCurrency?: string;
  priceThb: number;
  projectDeveloper?: string;
  projectName?: string;
  projectStatus?: PropertyProjectStatus;
  rawPayload?: Record<string, unknown>;
  rentalPriceMonthlyThb?: number;
  status: PropertyStatus;
  title: string;
}

interface ImportedCustomAttribute {
  key: string;
  label: string;
  type: ListingSourceCustomAttributeType;
  value: unknown;
  filterHint?: ListingSourceCustomAttributeMapping["filterHint"];
  searchable: boolean;
}

interface ImportRow {
  rowNumber: number;
  values: Record<string, unknown>;
}

interface ImportIssue {
  reason: string;
  rowNumber: number;
  title?: string;
}

interface ImportDraftOptions {
  relaxed?: boolean;
  storeRawPayload?: boolean;
}

export interface PropertyImportResult {
  [key: string]: unknown;
  dryRun: boolean;
  importMode: PropertyImportMode;
  imported: number;
  issues: ImportIssue[];
  knowledgeDocumentsCreated: number;
  propertyIds: string[];
  rowsMissingExternalId: number;
  rowsWithExternalId: number;
  searchRecordsCreated: number;
  skipped: number;
  source: PropertyImportJobPayload["source"];
  tenantId: string;
  total: number;
}

export class PropertyImporter {
  private readonly embeddings: KnowledgeEmbeddingGenerator;

  constructor(private readonly pool: Pool) {
    this.embeddings = new KnowledgeEmbeddingGenerator();
  }

  async import(job: PropertyImportJob): Promise<PropertyImportResult | Record<string, unknown>> {
    if (!job.data.objectUrl) {
      throw new Error("objectUrl is required for property import jobs");
    }

    const content = await this.readObjectText(job.data.objectUrl);
    const rows = parseImportRows(content, job.data);
    const issues: ImportIssue[] = [];
    const propertyIds: string[] = [];
    const importMode = job.data.importMode ?? "hybrid";
    const shouldCreateCrmInventory = importMode !== "concierge_index_only" && !job.data.dryRun;
    const shouldCreateConciergeSearchRecords = importMode === "concierge_index_only" && !job.data.dryRun;
    const shouldCreateAiKnowledge = importMode !== "crm_inventory" && !job.data.dryRun;
    let imported = 0;
    let knowledgeDocumentsCreated = 0;
    let rowsMissingExternalId = 0;
    let rowsWithExternalId = 0;

    await job.updateProgress({ imported, knowledgeDocumentsCreated, skipped: 0, total: rows.length });

    for (const [index, row] of rows.entries()) {
      try {
        const draft = toImportedPropertyDraft(row, {
          relaxed: importMode === "concierge_index_only",
          storeRawPayload: importMode === "concierge_index_only"
        });

        if (draft.externalId) {
          rowsWithExternalId += 1;
        } else {
          rowsMissingExternalId += 1;
        }

        if (shouldCreateCrmInventory || shouldCreateConciergeSearchRecords) {
          propertyIds.push(await this.insertProperty(job.data.tenantId, draft));
        }

        if (shouldCreateAiKnowledge) {
          await this.upsertKnowledgeListing(job.data.tenantId, draft, job.data.source, importMode);
          knowledgeDocumentsCreated += 1;
        }

        imported += 1;
      } catch (error) {
        issues.push({
          rowNumber: row.rowNumber,
          title: typeof row.values.title === "string" ? row.values.title : undefined,
          reason: error instanceof Error ? error.message : "Failed to import row"
        });
      }

      await job.updateProgress({
        imported,
        knowledgeDocumentsCreated,
        skipped: issues.length,
        total: rows.length,
        percent: rows.length > 0 ? Math.round(((index + 1) / rows.length) * 100) : 100
      });
    }

    return {
      tenantId: job.data.tenantId,
      source: job.data.source,
      dryRun: job.data.dryRun ?? false,
      importMode,
      crmRecordsCreated: shouldCreateCrmInventory ? propertyIds.length : 0,
      aiIndexCandidates: shouldCreateAiKnowledge ? knowledgeDocumentsCreated : 0,
      fieldMappingApplied: Boolean(job.data.fieldMapping),
      imported,
      knowledgeDocumentsCreated,
      skipped: issues.length,
      issues: issues.slice(0, 25),
      propertyIds,
      rowsMissingExternalId,
      rowsWithExternalId,
      searchRecordsCreated: propertyIds.length,
      sourceConfigId: job.data.sourceConfigId,
      total: rows.length
    };
  }

  private async readObjectText(objectUrl: string) {
    if (objectUrl.startsWith("data:")) {
      return readDataUrl(objectUrl);
    }

    const response = await fetch(objectUrl);

    if (!response.ok) {
      throw new Error(`Failed to read import object: ${response.status}`);
    }

    return response.text();
  }

  private async insertProperty(tenantId: string, draft: ImportedPropertyDraft): Promise<string> {
    const propertyId = crypto.randomUUID();
    const now = new Date().toISOString();
    const fallbackLocation = marketCoordinates[draft.market];
    const location = {
      latitude: draft.latitude ?? fallbackLocation.latitude,
      longitude: draft.longitude ?? fallbackLocation.longitude
    };

    const client = await this.pool.connect();

    try {
      await client.query("begin");
      const projectId = draft.projectName ? await this.upsertProject(client, tenantId, draft, now, location) : null;
      const upsertResult = await client.query<{ id: string }>(
        `
          insert into properties (
            id,
            tenant_id,
            project_id,
            external_id,
            title,
            description,
            kind,
            listing_type,
            market,
            status,
            price_amount,
            price_currency,
            rental_price_monthly_amount,
            rental_price_monthly_currency,
            location,
            latitude,
            longitude,
            address,
            bedrooms,
            bathrooms,
            area_sqm,
            floor,
            beach_distance_meters,
            monthly_rent_estimate_amount,
            monthly_rent_estimate_currency,
            maintenance_fee_monthly_amount,
            maintenance_fee_monthly_currency,
            amenities,
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
            $25,
            $10,
            'THB',
            $11,
            case when $11::numeric is null then null else 'THB' end,
            st_setsrid(st_makepoint($12, $13), 4326)::geography,
            $13,
            $12,
            $14,
            $15,
            $16,
            $17,
            $18,
            $19,
            $20,
            case when $20::numeric is null then null else 'THB' end,
            $21,
            case when $21::numeric is null then null else 'THB' end,
            $22,
            $23,
            $24
          )
          on conflict (tenant_id, external_id) where external_id is not null do update set
            project_id = excluded.project_id,
            title = excluded.title,
            description = excluded.description,
            kind = excluded.kind,
            listing_type = excluded.listing_type,
            market = excluded.market,
            status = excluded.status,
            price_amount = excluded.price_amount,
            price_currency = excluded.price_currency,
            rental_price_monthly_amount = excluded.rental_price_monthly_amount,
            rental_price_monthly_currency = excluded.rental_price_monthly_currency,
            location = excluded.location,
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            address = excluded.address,
            bedrooms = excluded.bedrooms,
            bathrooms = excluded.bathrooms,
            area_sqm = excluded.area_sqm,
            floor = excluded.floor,
            beach_distance_meters = excluded.beach_distance_meters,
            monthly_rent_estimate_amount = excluded.monthly_rent_estimate_amount,
            monthly_rent_estimate_currency = excluded.monthly_rent_estimate_currency,
            maintenance_fee_monthly_amount = excluded.maintenance_fee_monthly_amount,
            maintenance_fee_monthly_currency = excluded.maintenance_fee_monthly_currency,
            amenities = excluded.amenities,
            updated_at = excluded.updated_at
          returning id
        `,
        [
          propertyId,
          tenantId,
          projectId,
          draft.externalId ?? null,
          draft.title,
          draft.description ?? null,
          draft.kind,
          draft.listingType,
          draft.market,
          draft.priceThb,
          draft.rentalPriceMonthlyThb ?? null,
          location.longitude,
          location.latitude,
          draft.address ?? null,
          draft.bedrooms,
          draft.bathrooms,
          draft.areaSqm,
          draft.floor ?? null,
          draft.beachDistanceMeters ?? null,
          draft.monthlyRentEstimateThb ?? null,
          draft.maintenanceFeeMonthlyThb ?? null,
          draft.amenities,
          now,
          now,
          draft.status
        ]
      );
      await client.query(
        `
          insert into property_price_history (
            id,
            tenant_id,
            property_id,
            price_amount,
            price_currency,
            source,
            effective_date
          ) values (
            $1,
            $2,
            $3,
            $4,
            'THB',
            'import',
            $5
          )
        `,
        [crypto.randomUUID(), tenantId, upsertResult.rows[0].id, draft.priceThb, now]
      );
      await client.query("commit");
      return upsertResult.rows[0].id;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  private async upsertProject(
    client: Pick<Pool, "query">,
    tenantId: string,
    draft: ImportedPropertyDraft,
    now: string,
    location: { latitude: number; longitude: number }
  ): Promise<string> {
    const projectName = draft.projectName;

    if (!projectName) {
      throw new Error("Project name is required to upsert a project");
    }

    const result = await client.query<{ id: string }>(
      `
        insert into property_projects (
          id,
          tenant_id,
          name,
          normalized_name,
          market,
          status,
          developer,
          location,
          latitude,
          longitude,
          amenities,
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
          st_setsrid(st_makepoint($8, $9), 4326)::geography,
          $9,
          $8,
          $10,
          $11,
          $12
        )
        on conflict (tenant_id, market, normalized_name) do update set
          name = excluded.name,
          status = excluded.status,
          developer = coalesce(excluded.developer, property_projects.developer),
          location = coalesce(property_projects.location, excluded.location),
          latitude = coalesce(property_projects.latitude, excluded.latitude),
          longitude = coalesce(property_projects.longitude, excluded.longitude),
          amenities = case
            when cardinality(property_projects.amenities) = 0 then excluded.amenities
            else property_projects.amenities
          end,
          updated_at = excluded.updated_at
        returning id
      `,
      [
        crypto.randomUUID(),
        tenantId,
        projectName,
        normalizeProjectName(projectName),
        draft.market,
        draft.projectStatus ?? "completed",
        draft.projectDeveloper ?? null,
        location.longitude,
        location.latitude,
        draft.amenities,
        now,
        now
      ]
    );

    return result.rows[0].id;
  }

  private async upsertKnowledgeListing(
    tenantId: string,
    draft: ImportedPropertyDraft,
    source: PropertyImportJobPayload["source"],
    importMode: PropertyImportMode
  ): Promise<void> {
    const now = new Date().toISOString();
    const documentId = crypto.randomUUID();
    const body = buildListingKnowledgeBody(draft);
    const tags = buildListingKnowledgeTags(draft, source, importMode);
    const externalTag = draft.externalId ? externalIdTag(draft.externalId) : undefined;
    const chunks = this.chunkKnowledgeDocument(draft.title, body);
    const embeddedChunks = await Promise.all(
      chunks.map(async (chunk) => {
        const searchText = this.buildKnowledgeSearchText(draft.title, chunk, tags);

        try {
          return {
            chunk,
            searchText,
            embedding: await this.embeddings.embed(searchText, "document"),
            status: "embedded"
          };
        } catch {
          return {
            chunk,
            searchText,
            embedding: undefined,
            status: "failed"
          };
        }
      })
    );
    const client = await this.pool.connect();

    try {
      await client.query("begin");

      if (externalTag) {
        await this.deleteExistingKnowledgeListing(client, tenantId, externalTag);
      }

      await client.query(
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
            'en',
            'article',
            $5,
            $6,
            $7
          )
        `,
        [documentId, tenantId, draft.title, body, tags, now, now]
      );

      for (const [index, embeddedChunk] of embeddedChunks.entries()) {
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
              embedding,
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
              'en',
              'article',
              $7,
              $8,
              $9,
              $10,
              $11,
              $12,
              $13,
              $14
            )
          `,
          [
            crypto.randomUUID(),
            tenantId,
            documentId,
            index,
            draft.title,
            embeddedChunk.chunk,
            tags,
            this.estimateTokens(embeddedChunk.chunk),
            embeddedChunk.searchText,
            embeddedChunk.embedding?.vector ?? null,
            embeddedChunk.embedding?.modelKey ?? null,
            embeddedChunk.status,
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
  }

  private async deleteExistingKnowledgeListing(client: PoolClient, tenantId: string, externalTag: string) {
    await client.query(
      `
        delete from knowledge_document_chunks
        where tenant_id = $1
          and document_id in (
            select id
            from knowledge_documents
            where tenant_id = $1
              and 'property-listing' = any(tags)
              and $2 = any(tags)
          )
      `,
      [tenantId, externalTag]
    );
    await client.query(
      `
        delete from knowledge_documents
        where tenant_id = $1
          and 'property-listing' = any(tags)
          and $2 = any(tags)
      `,
      [tenantId, externalTag]
    );
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

}

function parseImportRows(content: string, payload: PropertyImportJobPayload): ImportRow[] {
  if (payload.source === "csv") {
    return parseCsvRows(content, payload.columnMapping);
  }

  if (payload.source === "partner-api" || payload.source === "partner-xml") {
    return parsePartnerFeedRows(content, payload.fieldMapping, payload.source);
  }

  return parseJsonRows(content);
}

export function parseImportedPropertyDraftsForDiagnostics(
  content: string,
  payload: Pick<PropertyImportJobPayload, "columnMapping" | "fieldMapping" | "importMode" | "source">
) {
  const importMode = payload.importMode ?? "hybrid";

  return parseImportRows(content, payload as PropertyImportJobPayload).map((row) =>
    toImportedPropertyDraft(row, {
      relaxed: importMode === "concierge_index_only",
      storeRawPayload: importMode === "concierge_index_only"
    })
  );
}

function parseJsonRows(content: string): ImportRow[] {
  const value = JSON.parse(content) as unknown;

  if (!Array.isArray(value)) {
    throw new Error("JSON import must be an array of listing objects");
  }

  return value.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error(`JSON row ${index + 1} must be an object`);
    }

    return {
      rowNumber: index + 1,
      values: item as Record<string, unknown>
    };
  });
}

function parsePartnerFeedRows(
  content: string,
  fieldMapping: ListingSourceFieldMapping | undefined,
  source: PartnerFeedSource
): ImportRow[] {
  if (!fieldMapping) {
    throw new Error("fieldMapping is required for partner feed property imports");
  }

  const value = source === "partner-xml" ? parseXmlFeed(content) : (JSON.parse(content) as unknown);
  const collection = resolvePartnerFeedCollection(value, fieldMapping.rootPath, source);

  return collection.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error(`Partner feed row ${index + 1} must be an object`);
    }

    return {
      rowNumber: index + 1,
      values: mapPartnerApiRow(item as Record<string, unknown>, fieldMapping)
    };
  });
}

function resolvePartnerFeedCollection(value: unknown, rootPath: string | undefined, source: PartnerFeedSource): unknown[] {
  if (rootPath) {
    const rootedValue = readPath(value, rootPath);

    if (Array.isArray(rootedValue)) {
      return rootedValue.filter(isRecord);
    }

    if (isRecord(rootedValue)) {
      return [rootedValue];
    }

    throw new Error(`Partner ${formatPartnerFeedSource(source)} rootPath "${rootPath}" must resolve to an array or object`);
  }

  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (isRecord(value)) {
    for (const key of ["items", "data", "listings", "listing", "properties", "property", "results"]) {
      const nestedValue = value[key];

      if (Array.isArray(nestedValue)) {
        return nestedValue.filter(isRecord);
      }

      if (isRecord(nestedValue)) {
        return resolvePartnerFeedCollection(nestedValue, undefined, source);
      }
    }

    return [value];
  }

  throw new Error("Partner feed response must be an object or array of listing rows");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatPartnerFeedSource(source: PartnerFeedSource): string {
  return source === "partner-xml" ? "XML" : "API";
}

function mapPartnerApiRow(row: Record<string, unknown>, fieldMapping: ListingSourceFieldMapping): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const [field, sourcePath] of Object.entries(fieldMapping.canonical)) {
    if (!sourcePath) {
      continue;
    }

    const value = readPath(row, sourcePath);

    if (value !== undefined) {
      values[canonicalFieldToImportKey(field as ListingSourceCanonicalField)] = value;
    }
  }

  const customAttributes = (fieldMapping.customAttributes ?? []).flatMap((attribute): ImportedCustomAttribute[] => {
    const value = readPath(row, attribute.sourcePath);

    if (value === undefined || value === null || value === "") {
      return [];
    }

    return [
      {
        key: attribute.key,
        label: attribute.label ?? humanizeAttributeKey(attribute.key),
        type: attribute.type,
        value: coerceCustomAttributeValue(value, attribute.type),
        filterHint: attribute.filterHint,
        searchable: attribute.searchable ?? true
      }
    ];
  });

  if (fieldMapping.rawPayloadMode === "store_all") {
    values.__rawPayload = row;
  }

  values.__customAttributes = customAttributes;

  return values;
}

function readPath(value: unknown, path: string): unknown {
  const segments = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
  let current = value;

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);

      if (Number.isInteger(index) && index >= 0 && index < current.length) {
        current = current[index];
        continue;
      }

      const mappedValues = current
        .map((item) => readPath(item, segment))
        .filter((item): item is Exclude<unknown, undefined> => item !== undefined);

      current = mappedValues.length ? mappedValues : undefined;
      continue;
    }

    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

interface XmlElement {
  attributes: Record<string, string>;
  children: XmlElement[];
  name: string;
  text: string;
}

function parseXmlFeed(content: string): Record<string, unknown> {
  const root: XmlElement = { attributes: {}, children: [], name: "__root__", text: "" };
  const stack = [root];
  const tokens = content.match(/<[^>]+>|[^<]+/g) ?? [];

  for (const token of tokens) {
    if (token.startsWith("<?") || token.startsWith("<!")) {
      continue;
    }

    if (token.startsWith("</")) {
      if (stack.length > 1) {
        stack.pop();
      }
      continue;
    }

    if (token.startsWith("<")) {
      const selfClosing = token.endsWith("/>");
      const tagBody = token.slice(1, selfClosing ? -2 : -1).trim();
      const [rawName = ""] = tagBody.split(/\s+/, 1);
      const name = normalizeXmlTagName(rawName);

      if (!name) {
        continue;
      }

      const element: XmlElement = {
        attributes: parseXmlAttributes(tagBody.slice(rawName.length)),
        children: [],
        name,
        text: ""
      };

      stack.at(-1)?.children.push(element);

      if (!selfClosing) {
        stack.push(element);
      }

      continue;
    }

    const text = decodeXmlText(token).trim();

    if (text) {
      const current = stack.at(-1);
      if (current) {
        current.text = [current.text, text].filter(Boolean).join(" ");
      }
    }
  }

  return xmlChildrenToObject(root.children);
}

function xmlChildrenToObject(children: XmlElement[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const child of children) {
    addXmlValue(result, child.name, xmlElementToValue(child));
  }

  return result;
}

function xmlElementToValue(element: XmlElement): unknown {
  const childrenValue = xmlChildrenToObject(element.children);
  const hasChildren = Object.keys(childrenValue).length > 0;
  const hasAttributes = Object.keys(element.attributes).length > 0;

  if (!hasChildren && !hasAttributes) {
    return element.text;
  }

  return {
    ...childrenValue,
    ...(element.text ? { text: element.text } : {}),
    ...(hasAttributes ? { attributes: element.attributes } : {})
  };
}

function addXmlValue(target: Record<string, unknown>, key: string, value: unknown) {
  const existing = target[key];

  if (existing === undefined) {
    target[key] = value;
    return;
  }

  if (Array.isArray(existing)) {
    existing.push(value);
    return;
  }

  target[key] = [existing, value];
}

function normalizeXmlTagName(name: string): string {
  return name.replace(/^[^:]+:/, "").trim();
}

function parseXmlAttributes(input: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([\w:.-]+)\s*=\s*(["'])(.*?)\2/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input))) {
    const rawName = match[1];
    const value = match[3];

    if (!rawName || value === undefined) {
      continue;
    }

    attributes[normalizeXmlTagName(rawName)] = decodeXmlText(value);
  }

  return attributes;
}

function decodeXmlText(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function canonicalFieldToImportKey(field: ListingSourceCanonicalField) {
  const keys = {
    externalId: "external_id",
    title: "title",
    description: "description",
    kind: "kind",
    listingType: "listing_type",
    market: "market",
    status: "status",
    priceAmount: "price",
    priceCurrency: "price_currency",
    rentalPriceMonthlyAmount: "monthly_rent",
    bedrooms: "bedrooms",
    bathrooms: "bathrooms",
    areaSqm: "area_sqm",
    floor: "floor",
    address: "address",
    latitude: "latitude",
    longitude: "longitude",
    projectName: "project_name",
    developerName: "developer",
    amenities: "amenities",
    imageUrls: "image_urls",
    availableFrom: "available_from",
    availableUntil: "available_until",
    minimumRentalMonths: "minimum_rental_months",
    foreignQuota: "foreign_quota",
    maintenanceFee: "maintenance"
  } satisfies Record<ListingSourceCanonicalField, string>;

  return keys[field];
}

function parseCsvRows(content: string, columnMapping: Record<string, string> | undefined): ImportRow[] {
  const records = parseCsvRecords(content).filter((record) => record.some((cell) => cell.trim().length > 0));

  if (records.length === 0) {
    return [];
  }

  const headers = records[0].map(normalizeHeader);

  return records.slice(1).map((record, index) => {
    const values = Object.fromEntries(headers.map((header, headerIndex) => [header, record[headerIndex]?.trim() ?? ""]));

    for (const [canonicalColumn, sourceColumn] of Object.entries(columnMapping ?? {})) {
      const normalizedCanonicalColumn = normalizeHeader(canonicalColumn);
      const normalizedSourceColumn = normalizeHeader(sourceColumn);

      if (values[normalizedSourceColumn] !== undefined) {
        values[normalizedCanonicalColumn] = values[normalizedSourceColumn];
      }
    }

    return {
      rowNumber: index + 2,
      values
    };
  });
}

function toImportedPropertyDraft(row: ImportRow, options: ImportDraftOptions = {}): ImportedPropertyDraft {
  const externalId = getString(
    getAlias(row.values, ["externalid", "external_id", "sourceid", "source_id", "reference_code", "referencecode", "listingid", "listing_id"])
  );
  const market = getEnumValue(normalizeEnumValue(getString(getAlias(row.values, ["market", "district"]))), supportedMarkets, "pattaya");
  const kind = getEnumValue(normalizeEnumValue(getString(getAlias(row.values, ["kind", "property_type", "propertytype"]))), supportedKinds, "condo");
  const projectName = getString(getAlias(row.values, ["projectname", "project_name", "development", "compound"]));
  const bedrooms = getInteger(row.values.bedrooms, 0);
  const areaSqm = getNumber(getAlias(row.values, ["areasqm", "area_sqm", "area", "size_sqm", "sizesqm"]), 1);
  const title = getString(row.values.title) ?? (options.relaxed ? buildRelaxedImportTitle(row, { areaSqm, bedrooms, externalId, kind, market, projectName }) : undefined);

  if (!title) {
    throw new Error("Missing title");
  }

  return {
    address: getAddress(row.values),
    amenities: getAmenities(getAlias(row.values, ["amenities", "features"]), row.values),
    areaSqm,
    availableFrom: getString(getAlias(row.values, ["availablefrom", "available_from", "available_start"])),
    availableUntil: getString(getAlias(row.values, ["availableuntil", "available_until", "available_end"])),
    bathrooms: getInteger(row.values.bathrooms, 0),
    beachDistanceMeters: getOptionalInteger(
      getAlias(row.values, ["beachdistancemeters", "beach_distance_meters", "distance_to_beach_m", "distancetobeachm"])
    ),
    bedrooms,
    customAttributes: [...getCustomAttributes(row.values.__customAttributes), ...getCsvCustomAttributes(row.values)],
    description: getString(row.values.description),
    externalId,
    floor: getOptionalInteger(row.values.floor),
    foreignQuota: getString(getAlias(row.values, ["foreignquota", "foreign_quota", "quota"])),
    kind,
    latitude: getOptionalNumber(row.values.latitude),
    listingType: getEnumValue(
      normalizeListingType(getString(getAlias(row.values, ["listingtype", "listing_type", "deal_type", "dealtype"]))),
      supportedListingTypes,
      "sale_or_rent"
    ),
    longitude: getOptionalNumber(row.values.longitude),
    maintenanceFeeMonthlyThb: getOptionalNumber(
      getAlias(row.values, ["maintenancefeemonthlythb", "maintenance_fee_monthly_thb", "maintenance"])
    ),
    market,
    minimumRentalMonths: getOptionalInteger(
      getAlias(row.values, ["minimumrentalmonths", "minimum_rental_months", "min_rental_months", "min_long_term_months"])
    ),
    monthlyRentEstimateThb: getOptionalNumber(
      getAlias(row.values, ["monthlyrentestimatethb", "monthly_rent_estimate_thb", "rentestimate"])
    ),
    priceCurrency: getString(getAlias(row.values, ["pricecurrency", "price_currency"])),
    priceThb: getNumber(getAlias(row.values, ["pricethb", "price_thb", "price", "sale_price_thb", "salepricethb"]), 0),
    projectDeveloper: getString(getAlias(row.values, ["projectdeveloper", "project_developer", "developer"])),
    projectName,
    projectStatus: getEnumValue(
      normalizeEnumValue(getString(getAlias(row.values, ["projectstatus", "project_status", "construction_status"]))),
      supportedProjectStatuses,
      "completed"
    ),
    rawPayload: options.storeRawPayload ? sanitizeRawPayload(row.values) : getRawPayload(row.values.__rawPayload),
    rentalPriceMonthlyThb: getOptionalNumber(
      getAlias(row.values, ["rentalpricemonthlythb", "rental_price_monthly_thb", "monthly_rent", "rent_long_term_thb_month"])
    ),
    status: getEnumValue(normalizeStatus(getString(row.values.status)), supportedPropertyStatuses, "draft"),
    title
  };
}

function parseCsvRecords(csv: string) {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRecord.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRecord.push(currentCell);
      records.push(currentRecord);
      currentRecord = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRecord.push(currentCell);
  records.push(currentRecord);

  return records;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function getAlias(values: Record<string, unknown>, keys: string[]) {
  return keys.map((key) => values[key]).find((value) => value !== undefined);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function normalizeProjectName(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(?:the|condo|condominium|village|project|residence|residences)\b/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function buildRelaxedImportTitle(
  row: ImportRow,
  context: {
    areaSqm: number;
    bedrooms: number;
    externalId?: string;
    kind: PropertyKind;
    market: ThailandMarket;
    projectName?: string;
  }
) {
  const reference = context.externalId ? ` ${context.externalId}` : ` row ${row.rowNumber}`;
  const bedroomLabel = context.bedrooms > 0 ? `${context.bedrooms}BR ` : "";
  const areaLabel = context.areaSqm > 1 ? `${context.areaSqm} sqm ` : "";
  const location = [getString(row.values.subdistrict), formatMarketLabel(context.market)].filter(Boolean).join(" - ");
  const parts = [
    `${bedroomLabel}${areaLabel}${formatPropertyKindLabel(context.kind)}`.trim(),
    context.projectName ? `at ${context.projectName}` : undefined,
    location ? `in ${location}` : undefined
  ].filter(Boolean);

  return `${parts.join(" ")}${reference}`;
}

function formatPropertyKindLabel(kind: PropertyKind) {
  return kind.replace(/_/g, " ");
}

function formatMarketLabel(market: ThailandMarket) {
  return market
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeEnumValue(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeListingType(value: string | undefined): PropertyListingType | undefined {
  const normalized = normalizeEnumValue(value)?.replace(/&/g, "_").replace(/_+/g, "_");

  if (!normalized) {
    return undefined;
  }

  if (["sale_and_rent", "sale_rent", "sales_and_rent", "buy_and_rent", "for_sale_and_rent"].includes(normalized)) {
    return "sale_or_rent";
  }

  if (["sale", "for_sale", "buy", "purchase"].includes(normalized)) {
    return "sale";
  }

  if (["rent", "rental", "for_rent", "lease"].includes(normalized)) {
    return "rent";
  }

  return normalized as PropertyListingType;
}

function normalizeStatus(value: string | undefined): PropertyStatus | undefined {
  const normalized = normalizeEnumValue(value);

  if (!normalized) {
    return undefined;
  }

  if (["active", "available", "published", "live"].includes(normalized)) {
    return "available";
  }

  if (["reserved", "booked", "pending"].includes(normalized)) {
    return "reserved";
  }

  if (["sold"].includes(normalized)) {
    return "sold";
  }

  if (["rented", "leased"].includes(normalized)) {
    return "rented";
  }

  if (["archived", "inactive", "unavailable"].includes(normalized)) {
    return "archived";
  }

  return normalized as PropertyStatus;
}

function getEnumValue<const T extends readonly string[]>(value: string | undefined, values: T, fallback: T[number]): T[number] {
  return values.includes(value as T[number]) ? (value as T[number]) : fallback;
}

function getNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function getOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : undefined;
}

function getInteger(value: unknown, fallback: number) {
  return Math.trunc(getNumber(value, fallback));
}

function getOptionalInteger(value: unknown) {
  const numberValue = getOptionalNumber(value);

  return numberValue === undefined ? undefined : Math.trunc(numberValue);
}

function getAddress(values: Record<string, unknown>) {
  const explicit = getString(values.address);

  if (explicit) {
    return explicit;
  }

  return [getString(values.subdistrict), getString(values.district)].filter(Boolean).join(", ") || undefined;
}

function getAmenities(value: unknown, values: Record<string, unknown> = {}): string[] {
  const flags = [
    { amenity: "pet-friendly", value: hasPetFriendlySignal(values) },
    { amenity: "furnished", value: values.furnished },
    { amenity: "sea-view", value: values.sea_view },
    { amenity: "pool-view", value: values.pool_view },
    { amenity: "private-pool", value: values.private_pool },
    { amenity: "parking", value: values.parking }
  ]
    .filter((flag) => isTruthyCsvValue(flag.value))
    .map((flag) => flag.amenity);

  if (Array.isArray(value)) {
    return Array.from(new Set([...value.map((item) => String(item).trim()).filter(Boolean), ...flags]));
  }

  const parsed = String(value ?? "")
    .split(/[|,;]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set([...parsed, ...flags]));
}

function hasPetFriendlySignal(values: Record<string, unknown>) {
  const explicitValue = getFirstPresentValue(values, [
    "pet_friendly",
    "petfriendly",
    "pets_allowed",
    "petsallowed",
    "allows_pets",
    "allowspets",
    "pet_allowed",
    "petallowed",
    "dogs_allowed",
    "dogsallowed",
    "cats_allowed",
    "catsallowed"
  ]);

  if (isTruthyCsvValue(explicitValue)) {
    return true;
  }

  const policy = getString(getFirstPresentValue(values, ["pet_policy", "petpolicy", "pet_policy_notes", "petpolicynotes", "pets_policy", "pet_notes"]));

  return Boolean(policy && /(?:allowed|allow|yes|ok|friendly|dogs?|cats?|pets?|можно|разреш|да|สัตว์เลี้ยง|允许|允許|可养|可養)/i.test(policy));
}

function getFirstPresentValue(values: Record<string, unknown>, keys: string[]) {
  return keys.map((key) => values[key]).find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function isTruthyCsvValue(value: unknown) {
  return /^(?:yes|true|1|available|fully furnished)$/i.test(String(value ?? "").trim());
}

function getCustomAttributes(value: unknown): ImportedCustomAttribute[] {
  return Array.isArray(value) ? value.filter(isImportedCustomAttribute) : [];
}

function getCsvCustomAttributes(values: Record<string, unknown>): ImportedCustomAttribute[] {
  const definitions: Array<{
    key: string;
    label: string;
    sourceKey: string;
    type: ListingSourceCustomAttributeType;
    searchable?: boolean;
  }> = [
    { key: "short_term_rent_thb_month", label: "Short-term rent THB/month", sourceKey: "rent_short_term_thb_month", type: "number" },
    { key: "min_short_term_months", label: "Minimum short-term rental months", sourceKey: "min_short_term_months", type: "number" },
    { key: "deposit_months", label: "Deposit months", sourceKey: "deposit_months", type: "number" },
    { key: "pet_policy_notes", label: "Pet policy notes", sourceKey: "pet_policy_notes", type: "text" },
    { key: "ownership", label: "Ownership", sourceKey: "ownership", type: "text" },
    { key: "contact_channel", label: "Contact channel", sourceKey: "contact_channel", type: "enum" }
  ];

  return definitions
    .map((definition) => {
      const value = values[definition.sourceKey];

      if (value === undefined || value === null || String(value).trim() === "") {
        return undefined;
      }

      return {
        key: definition.key,
        label: definition.label,
        searchable: definition.searchable ?? true,
        type: definition.type,
        value: coerceCustomAttributeValue(value, definition.type)
      } satisfies ImportedCustomAttribute;
    })
    .filter((attribute): attribute is ImportedCustomAttribute => Boolean(attribute));
}

function getRawPayload(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function sanitizeRawPayload(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !key.startsWith("__")));
}

function isImportedCustomAttribute(value: unknown): value is ImportedCustomAttribute {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ImportedCustomAttribute).key === "string" &&
    typeof (value as ImportedCustomAttribute).label === "string"
  );
}

function coerceCustomAttributeValue(value: unknown, type: ListingSourceCustomAttributeType): unknown {
  switch (type) {
    case "number": {
      const numberValue = Number(value);
      return Number.isFinite(numberValue) ? numberValue : String(value);
    }
    case "boolean":
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string") {
        return ["true", "yes", "1", "available"].includes(value.trim().toLowerCase());
      }
      return Boolean(value);
    case "date":
    case "enum":
    case "text":
      return typeof value === "string" ? value.trim() : String(value);
    case "json":
      return value;
  }
}

function buildListingKnowledgeBody(draft: ImportedPropertyDraft) {
  return [
    `Listing type: ${formatListingType(draft.listingType)}`,
    `Property kind: ${draft.kind}`,
    `Market: ${draft.market}`,
    `Status: ${draft.status}`,
    draft.address ? `Address or landmark: ${draft.address}` : undefined,
    draft.projectName ? `Project: ${draft.projectName}` : undefined,
    draft.projectDeveloper ? `Developer: ${draft.projectDeveloper}` : undefined,
    draft.projectStatus ? `Project status: ${draft.projectStatus}` : undefined,
    draft.priceThb > 0 ? `Price: ${draft.priceCurrency ?? "THB"} ${draft.priceThb}` : undefined,
    draft.rentalPriceMonthlyThb ? `${hasShortTermRent(draft) ? "Long-term monthly rent" : "Monthly rent"}: THB ${draft.rentalPriceMonthlyThb}` : undefined,
    draft.monthlyRentEstimateThb ? `Estimated monthly rent: THB ${draft.monthlyRentEstimateThb}` : undefined,
    draft.maintenanceFeeMonthlyThb ? `Maintenance fee: THB ${draft.maintenanceFeeMonthlyThb} per month` : undefined,
    draft.availableFrom ? `Available from: ${draft.availableFrom}` : undefined,
    draft.availableUntil ? `Available until: ${draft.availableUntil}` : undefined,
    draft.minimumRentalMonths ? `Minimum rental term: ${draft.minimumRentalMonths} months` : undefined,
    draft.foreignQuota ? `Foreign quota: ${draft.foreignQuota}` : undefined,
    `Area: ${draft.areaSqm} sqm`,
    `Bedrooms: ${draft.bedrooms}`,
    `Bathrooms: ${draft.bathrooms}`,
    draft.floor ? `Floor: ${draft.floor}` : undefined,
    draft.beachDistanceMeters ? `Beach distance: ${draft.beachDistanceMeters} meters` : undefined,
    draft.amenities.length ? `Amenities: ${draft.amenities.join(", ")}` : undefined,
    draft.description ? `Description: ${draft.description}` : undefined,
    draft.customAttributes.length ? buildCustomAttributesKnowledgeBlock(draft.customAttributes) : undefined,
    draft.rawPayload ? buildRawPayloadKnowledgeBlock(draft.rawPayload) : undefined
  ]
    .filter(Boolean)
    .join("\n");
}

function hasShortTermRent(draft: ImportedPropertyDraft) {
  return draft.customAttributes.some((attribute) => attribute.key === "short_term_rent_thb_month" && attribute.value);
}

function buildCustomAttributesKnowledgeBlock(attributes: ImportedCustomAttribute[]) {
  const lines = attributes
    .filter((attribute) => attribute.searchable)
    .map((attribute) => {
      const hint = attribute.filterHint && attribute.filterHint !== "other" ? ` (${attribute.filterHint})` : "";

      return `${attribute.label}${hint}: ${formatCustomAttributeValue(attribute.value)}`;
    });

  return lines.length ? ["Source-specific agency fields:", ...lines].join("\n") : undefined;
}

function buildRawPayloadKnowledgeBlock(payload: Record<string, unknown>) {
  const serialized = JSON.stringify(payload);
  const truncated = serialized.length > 4000 ? `${serialized.slice(0, 4000)}...` : serialized;

  return `Full source payload for agency-specific constraints: ${truncated}`;
}

function formatCustomAttributeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(formatCustomAttributeValue).join(", ");
  }

  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}

function buildListingKnowledgeTags(
  draft: ImportedPropertyDraft,
  source: PropertyImportJobPayload["source"],
  importMode: PropertyImportMode
) {
  return uniqueStrings(
    [
      "property-listing",
      `source:${source}`,
      `import-mode:${importMode}`,
      `market:${draft.market}`,
      `kind:${draft.kind}`,
      `listing-type:${draft.listingType}`,
      draft.externalId ? externalIdTag(draft.externalId) : undefined,
      draft.projectName ? `project:${normalizeProjectName(draft.projectName)}` : undefined,
      ...draft.amenities.map((amenity) => `amenity:${normalizeTagValue(amenity)}`),
      ...draft.customAttributes
        .filter((attribute) => attribute.searchable)
        .map((attribute) => `custom:${normalizeTagValue(attribute.key)}`)
    ].filter(isString)
  );
}

function externalIdTag(externalId: string) {
  return `external-id:${normalizeTagValue(externalId)}`;
}

function normalizeTagValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function humanizeAttributeKey(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatListingType(value: PropertyListingType) {
  const labels = {
    rent: "for rent",
    sale: "for sale",
    sale_or_rent: "for sale or rent"
  } satisfies Record<PropertyListingType, string>;

  return labels[value];
}

function readDataUrl(objectUrl: string) {
  const commaIndex = objectUrl.indexOf(",");

  if (commaIndex < 0) {
    throw new Error("Invalid data URL import object");
  }

  const metadata = objectUrl.slice(0, commaIndex);
  const data = objectUrl.slice(commaIndex + 1);

  return metadata.endsWith(";base64") ? Buffer.from(data, "base64").toString("utf8") : decodeURIComponent(data);
}
