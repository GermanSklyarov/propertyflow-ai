import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type {
  BackgroundJobSnapshot,
  CreateListingSourceRequest,
  ListingSourceAuthType,
  ListingSourceCanonicalField,
  ListingSourceCustomAttributeFilterHint,
  ListingSourceCustomAttributeMapping,
  ListingSourceCustomAttributeType,
  ListingSourceFieldMapping,
  ListingSourceImportMode,
  ListingSourceListResponse,
  ListingSourcePreviewResponse,
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
const requiredPreviewFields: ListingSourceCanonicalField[] = ["title", "market"];
const previewSampleSize = 3;
const previewTimeoutMs = 5000;

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

  async preview(_tenantId: string, request: CreateListingSourceRequest): Promise<ListingSourcePreviewResponse> {
    const normalized = this.normalizeCreateRequest(request);
    const payload = await this.fetchPreviewPayload(normalized);
    const items = this.extractPreviewItems(payload, normalized.mapping.rootPath);
    const samples = items.slice(0, previewSampleSize);
    const canonical = Object.entries(normalized.mapping.canonical).map(([field, sourcePath]) => {
      const sampleValue = this.firstMappedSample(samples, sourcePath);

      return {
        field: field as ListingSourceCanonicalField,
        sourcePath,
        present: sampleValue !== undefined,
        ...(sampleValue !== undefined ? { sampleValue } : {})
      };
    });
    const customAttributes = (normalized.mapping.customAttributes ?? []).map((attribute) => {
      const sampleValue = this.firstMappedSample(samples, attribute.sourcePath);

      return {
        key: attribute.key,
        sourcePath: attribute.sourcePath,
        present: sampleValue !== undefined,
        ...(sampleValue !== undefined ? { sampleValue } : {}),
        ...(attribute.filterHint ? { filterHint: attribute.filterHint } : {})
      };
    });
    const missingRequiredFields = requiredPreviewFields.filter(
      (field) => !canonical.some((result) => result.field === field && result.present)
    );
    const warnings = this.buildPreviewWarnings({
      customAttributeCount: customAttributes.length,
      missingRequiredFields,
      normalized,
      presentCustomAttributeCount: customAttributes.filter((result) => result.present).length
    });

    return {
      endpointUrl: normalized.endpointUrl,
      ok: missingRequiredFields.length === 0,
      rootPath: normalized.mapping.rootPath,
      itemCount: items.length,
      sampleCount: samples.length,
      canonical,
      customAttributes,
      missingRequiredFields,
      warnings
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

  private async fetchPreviewPayload(source: CreateListingSourceRequest): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), previewTimeoutMs);

    try {
      const headers: Record<string, string> = {
        accept: "application/json"
      };

      if (source.authType === "api-key-header" && source.authHeaderName && source.authSecretRef) {
        headers[source.authHeaderName] = source.authSecretRef;
      }
      if (source.authType === "bearer" && source.authSecretRef) {
        headers.authorization = `Bearer ${source.authSecretRef}`;
      }

      const response = await fetch(source.endpointUrl, {
        headers,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new BadRequestException(`Listing source preview failed with HTTP ${response.status}.`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException("Listing source preview could not read a JSON response from the endpoint.");
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractPreviewItems(payload: unknown, rootPath?: string): unknown[] {
    const root = rootPath ? this.readMappedPath(payload, rootPath) : this.resolveImplicitItems(payload);
    if (!Array.isArray(root)) {
      throw new BadRequestException("Listing source preview did not find an array of listings. Check the root path.");
    }
    if (!root.length) {
      throw new BadRequestException("Listing source preview found zero listings in the feed.");
    }

    return root;
  }

  private resolveImplicitItems(payload: unknown): unknown {
    if (Array.isArray(payload)) {
      return payload;
    }
    const items = this.readMappedPath(payload, "items");
    if (Array.isArray(items)) {
      return items;
    }
    const dataItems = this.readMappedPath(payload, "data.items");
    if (Array.isArray(dataItems)) {
      return dataItems;
    }
    const data = this.readMappedPath(payload, "data");
    if (Array.isArray(data)) {
      return data;
    }

    return payload;
  }

  private firstMappedSample(samples: unknown[], sourcePath: string): unknown {
    for (const sample of samples) {
      const value = this.toPreviewSampleValue(this.readMappedPath(sample, sourcePath));
      if (value !== undefined) {
        return value;
      }
    }

    return undefined;
  }

  private readMappedPath(payload: unknown, sourcePath: string): unknown {
    return sourcePath.split(".").reduce<unknown>((current, segment) => {
      if (!segment || current === null || current === undefined) {
        return undefined;
      }
      if (Array.isArray(current)) {
        const index = Number(segment);
        return Number.isInteger(index) ? current[index] : undefined;
      }
      if (typeof current === "object") {
        return (current as Record<string, unknown>)[segment];
      }

      return undefined;
    }, payload);
  }

  private toPreviewSampleValue(value: unknown): unknown {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.slice(0, 4);
    }
    if (typeof value === "object") {
      return JSON.stringify(value).slice(0, 180);
    }

    return value;
  }

  private buildPreviewWarnings(input: {
    customAttributeCount: number;
    missingRequiredFields: ListingSourceCanonicalField[];
    normalized: CreateListingSourceRequest;
    presentCustomAttributeCount: number;
  }): string[] {
    const warnings: string[] = [];

    if (input.missingRequiredFields.length) {
      warnings.push(`Missing required mapped fields: ${input.missingRequiredFields.join(", ")}.`);
    }
    if (input.normalized.authType !== "none" && !input.normalized.authSecretRef) {
      warnings.push("Auth is enabled, but no secret reference was provided for the preview request.");
    }
    if (input.customAttributeCount > 0 && input.presentCustomAttributeCount === 0) {
      warnings.push("Custom attributes are configured, but none were found in the sample listings.");
    }
    if (input.normalized.mapping.rawPayloadMode === "store_all") {
      warnings.push("Raw payload storage is enabled; verify tenant data retention rules before production sync.");
    }

    return warnings;
  }
}
