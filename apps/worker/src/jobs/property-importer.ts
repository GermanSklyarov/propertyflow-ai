import type { Job } from "bullmq";
import type { Pool, PoolClient } from "pg";
import type { PropertyImportJobPayload } from "@propertyflow/contracts";
import type { PropertyKind, PropertyListingType, PropertyProjectStatus, ThailandMarket } from "@propertyflow/domain";

type PropertyImportJob = Job<PropertyImportJobPayload, unknown, "properties.import">;
type PropertyImportMode = NonNullable<PropertyImportJobPayload["importMode"]>;

const supportedMarkets = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"] as const;
const supportedKinds = ["condo", "villa", "townhouse", "land", "commercial"] as const;
const supportedListingTypes = ["sale", "rent", "sale_or_rent"] as const;
const supportedProjectStatuses = ["planned", "under_construction", "completed", "paused"] as const;

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
  bathrooms: number;
  beachDistanceMeters?: number;
  bedrooms: number;
  description?: string;
  externalId?: string;
  floor?: number;
  kind: PropertyKind;
  listingType: PropertyListingType;
  maintenanceFeeMonthlyThb?: number;
  market: ThailandMarket;
  monthlyRentEstimateThb?: number;
  priceThb: number;
  projectDeveloper?: string;
  projectName?: string;
  projectStatus?: PropertyProjectStatus;
  rentalPriceMonthlyThb?: number;
  title: string;
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
  skipped: number;
  source: PropertyImportJobPayload["source"];
  tenantId: string;
  total: number;
}

export class PropertyImporter {
  constructor(private readonly pool: Pool) {}

  async import(job: PropertyImportJob): Promise<PropertyImportResult | Record<string, unknown>> {
    if (job.data.source === "partner-api") {
      return {
        tenantId: job.data.tenantId,
        source: job.data.source,
        dryRun: job.data.dryRun ?? false,
        importMode: job.data.importMode ?? "hybrid",
        imported: 0,
        skipped: 0,
        status: "partner-api-adapter-not-configured"
      };
    }

    if (!job.data.objectUrl) {
      throw new Error("objectUrl is required for property import jobs");
    }

    const content = await this.readObjectText(job.data.objectUrl);
    const rows = job.data.source === "json" ? parseJsonRows(content) : parseCsvRows(content, job.data.columnMapping);
    const issues: ImportIssue[] = [];
    const propertyIds: string[] = [];
    const importMode = job.data.importMode ?? "hybrid";
    const shouldCreateCrmInventory = importMode !== "concierge_index_only" && !job.data.dryRun;
    const shouldCreateAiKnowledge = importMode !== "crm_inventory" && !job.data.dryRun;
    let imported = 0;
    let knowledgeDocumentsCreated = 0;
    let rowsMissingExternalId = 0;
    let rowsWithExternalId = 0;

    await job.updateProgress({ imported, knowledgeDocumentsCreated, skipped: 0, total: rows.length });

    for (const [index, row] of rows.entries()) {
      try {
        const draft = toImportedPropertyDraft(row);

        if (draft.externalId) {
          rowsWithExternalId += 1;
        } else {
          rowsMissingExternalId += 1;
        }

        if (shouldCreateCrmInventory) {
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
      crmRecordsCreated: propertyIds.length,
      aiIndexCandidates: shouldCreateAiKnowledge ? knowledgeDocumentsCreated : 0,
      imported,
      knowledgeDocumentsCreated,
      skipped: issues.length,
      issues: issues.slice(0, 25),
      propertyIds,
      rowsMissingExternalId,
      rowsWithExternalId,
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
    const location = marketCoordinates[draft.market];

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
            'draft',
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
          now
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
    const embeddingModel = "local-hash-16";
    const embeddingDimensions = 16;
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

      for (const [index, chunk] of chunks.entries()) {
        const searchText = this.buildKnowledgeSearchText(draft.title, chunk, tags);

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
              'embedded',
              $12,
              $13
            )
          `,
          [
            crypto.randomUUID(),
            tenantId,
            documentId,
            index,
            draft.title,
            chunk,
            tags,
            this.estimateTokens(chunk),
            searchText,
            this.embedText(searchText, embeddingDimensions),
            embeddingModel,
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

function toImportedPropertyDraft(row: ImportRow): ImportedPropertyDraft {
  const title = getString(row.values.title);

  if (!title) {
    throw new Error("Missing title");
  }

  const market = getEnumValue(getString(row.values.market), supportedMarkets, "pattaya");

  return {
    address: getString(row.values.address),
    amenities: getAmenities(row.values.amenities),
    areaSqm: getNumber(getAlias(row.values, ["areasqm", "area_sqm", "area"]), 1),
    bathrooms: getInteger(row.values.bathrooms, 0),
    beachDistanceMeters: getOptionalInteger(getAlias(row.values, ["beachdistancemeters", "beach_distance_meters"])),
    bedrooms: getInteger(row.values.bedrooms, 0),
    description: getString(row.values.description),
    externalId: getString(getAlias(row.values, ["externalid", "external_id", "sourceid", "source_id", "listingid", "listing_id"])),
    floor: getOptionalInteger(row.values.floor),
    kind: getEnumValue(getString(row.values.kind), supportedKinds, "condo"),
    listingType: getEnumValue(getString(getAlias(row.values, ["listingtype", "listing_type"])), supportedListingTypes, "sale_or_rent"),
    maintenanceFeeMonthlyThb: getOptionalNumber(
      getAlias(row.values, ["maintenancefeemonthlythb", "maintenance_fee_monthly_thb", "maintenance"])
    ),
    market,
    monthlyRentEstimateThb: getOptionalNumber(
      getAlias(row.values, ["monthlyrentestimatethb", "monthly_rent_estimate_thb", "rentestimate"])
    ),
    priceThb: getNumber(getAlias(row.values, ["pricethb", "price_thb", "price"]), 0),
    projectDeveloper: getString(getAlias(row.values, ["projectdeveloper", "project_developer", "developer"])),
    projectName: getString(getAlias(row.values, ["projectname", "project_name", "development", "compound"])),
    projectStatus: getEnumValue(
      getString(getAlias(row.values, ["projectstatus", "project_status", "construction_status"])),
      supportedProjectStatuses,
      "completed"
    ),
    rentalPriceMonthlyThb: getOptionalNumber(
      getAlias(row.values, ["rentalpricemonthlythb", "rental_price_monthly_thb", "monthly_rent"])
    ),
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

function getAmenities(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildListingKnowledgeBody(draft: ImportedPropertyDraft) {
  return [
    `Listing type: ${formatListingType(draft.listingType)}`,
    `Property kind: ${draft.kind}`,
    `Market: ${draft.market}`,
    draft.address ? `Address or landmark: ${draft.address}` : undefined,
    draft.projectName ? `Project: ${draft.projectName}` : undefined,
    draft.projectDeveloper ? `Developer: ${draft.projectDeveloper}` : undefined,
    draft.projectStatus ? `Project status: ${draft.projectStatus}` : undefined,
    `Price: THB ${draft.priceThb}`,
    draft.rentalPriceMonthlyThb ? `Monthly rent: THB ${draft.rentalPriceMonthlyThb}` : undefined,
    draft.monthlyRentEstimateThb ? `Estimated monthly rent: THB ${draft.monthlyRentEstimateThb}` : undefined,
    draft.maintenanceFeeMonthlyThb ? `Maintenance fee: THB ${draft.maintenanceFeeMonthlyThb} per month` : undefined,
    `Area: ${draft.areaSqm} sqm`,
    `Bedrooms: ${draft.bedrooms}`,
    `Bathrooms: ${draft.bathrooms}`,
    draft.floor ? `Floor: ${draft.floor}` : undefined,
    draft.beachDistanceMeters ? `Beach distance: ${draft.beachDistanceMeters} meters` : undefined,
    draft.amenities.length ? `Amenities: ${draft.amenities.join(", ")}` : undefined,
    draft.description ? `Description: ${draft.description}` : undefined
  ]
    .filter(Boolean)
    .join("\n");
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
      ...draft.amenities.map((amenity) => `amenity:${normalizeTagValue(amenity)}`)
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
