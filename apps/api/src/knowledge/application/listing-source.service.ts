import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type {
  BackgroundJobSnapshot,
  CreateListingSourceRequest,
  ListingSourceAuthType,
  ListingSourceCustomAttributeFilterHint,
  ListingSourceCustomAttributeMapping,
  ListingSourceCustomAttributeType,
  ListingSourceFieldMapping,
  ListingSourceImportMode,
  ListingSourceListResponse,
  ListingSourceSnapshot,
  ListingSourceType
} from "@propertyflow/contracts";
import { JobQueueService } from "../../jobs/application/job-queue.service.js";
import {
  LISTING_SOURCE_REPOSITORY,
  type ListingSourceRepository
} from "../domain/listing-source.repository.js";

const allowedTypes: ListingSourceType[] = ["rest-api"];
const allowedAuthTypes: ListingSourceAuthType[] = ["none", "bearer", "api-key-header"];
const allowedImportModes: ListingSourceImportMode[] = ["crm_inventory", "concierge_index_only", "hybrid"];
const allowedAttributeTypes: ListingSourceCustomAttributeType[] = ["text", "number", "boolean", "date", "enum", "json"];
const allowedFilterHints: ListingSourceCustomAttributeFilterHint[] = [
  "availability",
  "contract_term",
  "fee",
  "restriction",
  "view",
  "amenity",
  "ownership",
  "other"
];

@Injectable()
export class ListingSourceService {
  constructor(
    @Inject(LISTING_SOURCE_REPOSITORY) private readonly sources: ListingSourceRepository,
    @Inject(JobQueueService) private readonly jobs: JobQueueService
  ) {}

  async create(tenantId: string, request: CreateListingSourceRequest): Promise<ListingSourceSnapshot> {
    return this.sources.save(tenantId, this.normalizeCreateRequest(request));
  }

  async list(tenantId: string): Promise<ListingSourceListResponse> {
    const items = await this.sources.list(tenantId);

    return {
      items,
      total: items.length
    };
  }

  async sync(
    tenantId: string,
    requestedByUserId: string | undefined,
    sourceId: string
  ): Promise<BackgroundJobSnapshot> {
    const source = await this.sources.findById(tenantId, sourceId);

    if (!source) {
      throw new BadRequestException("Listing source was not found for this tenant.");
    }

    await this.sources.markSyncStarted(tenantId, sourceId);

    return this.jobs.enqueue("properties.import", {
      tenantId,
      requestedByUserId,
      source: "partner-api",
      importMode: source.importMode,
      objectUrl: source.endpointUrl,
      sourceConfigId: source.id,
      fieldMapping: source.mapping
    });
  }

  private normalizeCreateRequest(request: CreateListingSourceRequest): CreateListingSourceRequest {
    const name = request.name.trim();
    if (name.length < 3) {
      throw new BadRequestException("Listing source name must contain at least 3 characters.");
    }

    const type = request.type ?? "rest-api";
    if (!allowedTypes.includes(type)) {
      throw new BadRequestException("Unsupported listing source type.");
    }

    const authType = request.authType ?? "none";
    if (!allowedAuthTypes.includes(authType)) {
      throw new BadRequestException("Unsupported listing source auth type.");
    }

    const importMode = request.importMode ?? "hybrid";
    if (!allowedImportModes.includes(importMode)) {
      throw new BadRequestException("Unsupported listing source import mode.");
    }

    return {
      name,
      type,
      endpointUrl: this.normalizeEndpointUrl(request.endpointUrl),
      authType,
      authHeaderName: this.optionalString(request.authHeaderName),
      authSecretRef: this.optionalString(request.authSecretRef),
      importMode,
      mapping: this.normalizeMapping(request.mapping)
    };
  }

  private normalizeEndpointUrl(endpointUrl: string): string {
    try {
      const parsed = new URL(endpointUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Unsupported protocol");
      }
      return parsed.toString();
    } catch {
      throw new BadRequestException("Listing source endpoint must be a valid HTTP URL.");
    }
  }

  private normalizeMapping(mapping: ListingSourceFieldMapping): ListingSourceFieldMapping {
    if (!mapping || typeof mapping !== "object") {
      throw new BadRequestException("Listing source mapping is required.");
    }

    const canonical = Object.fromEntries(
      Object.entries(mapping.canonical ?? {})
        .map(([field, path]) => [field, this.optionalString(path)])
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    );
    if (!Object.keys(canonical).length) {
      throw new BadRequestException("Map at least one canonical listing field.");
    }

    return {
      rootPath: this.optionalString(mapping.rootPath),
      canonical: canonical as ListingSourceFieldMapping["canonical"],
      customAttributes: this.normalizeCustomAttributes(mapping.customAttributes ?? []),
      rawPayloadMode: mapping.rawPayloadMode === "store_all" ? "store_all" : "store_selected"
    };
  }

  private normalizeCustomAttributes(attributes: ListingSourceCustomAttributeMapping[]): ListingSourceCustomAttributeMapping[] {
    const seenKeys = new Set<string>();

    return attributes.map((attribute) => {
      const key = this.normalizeAttributeKey(attribute.key);
      if (seenKeys.has(key)) {
        throw new BadRequestException(`Custom attribute "${key}" is mapped more than once.`);
      }
      seenKeys.add(key);

      const type = allowedAttributeTypes.includes(attribute.type) ? attribute.type : "text";
      const filterHint = attribute.filterHint && allowedFilterHints.includes(attribute.filterHint)
        ? attribute.filterHint
        : "other";
      const sourcePath = this.optionalString(attribute.sourcePath);

      if (!sourcePath) {
        throw new BadRequestException(`Custom attribute "${key}" must have a source path.`);
      }

      return {
        key,
        sourcePath,
        type,
        label: this.optionalString(attribute.label),
        description: this.optionalString(attribute.description),
        searchable: attribute.searchable ?? true,
        filterHint
      };
    });
  }

  private normalizeAttributeKey(key: string): string {
    const normalized = key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    if (!normalized) {
      throw new BadRequestException("Custom attribute key is required.");
    }
    return normalized;
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }
}
