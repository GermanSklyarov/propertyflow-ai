import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { EnqueueBackgroundJobRequest, RequestUser } from "@propertyflow/contracts";
import { BackgroundJobPolicyService } from "./background-job-policy.service.js";

describe("BackgroundJobPolicyService", () => {
  const service = new BackgroundJobPolicyService();
  const broker: RequestUser = {
    id: "broker-1",
    role: "broker",
    tenantId: "demo-agency"
  };
  const manager: RequestUser = {
    id: "manager-1",
    role: "manager",
    tenantId: "demo-agency"
  };

  it("allows managers to refresh stale knowledge embeddings", () => {
    expect(() =>
      service.authorize(manager, {
        name: "knowledge.chunks.embed",
        payload: {
          dimensions: 768,
          model: "gemini-embedding-001",
          provider: "gemini",
          refreshExisting: true,
          tenantId: "demo-agency"
        }
      } satisfies EnqueueBackgroundJobRequest)
    ).not.toThrow();
  });

  it("allows property imports that only feed AI Concierge", () => {
    expect(() =>
      service.authorize(broker, {
        name: "properties.import",
        payload: {
          importMode: "concierge_index_only",
          objectUrl: "data:text/csv;charset=utf-8,title",
          source: "csv",
          tenantId: "demo-agency"
        }
      } satisfies EnqueueBackgroundJobRequest)
    ).not.toThrow();
  });

  it("allows brokers to enrich existing listing locations in batches", () => {
    expect(() =>
      service.authorize(broker, {
        name: "properties.location.enrich_existing",
        payload: {
          limit: 500,
          market: "pattaya",
          refreshExisting: false,
          tenantId: "demo-agency"
        }
      } satisfies EnqueueBackgroundJobRequest)
    ).not.toThrow();
  });

  it("rejects oversized existing listing location enrichment batches", () => {
    expect(() =>
      service.authorize(broker, {
        name: "properties.location.enrich_existing",
        payload: {
          limit: 5000,
          tenantId: "demo-agency"
        }
      } satisfies EnqueueBackgroundJobRequest)
    ).toThrow(BadRequestException);
  });

  it("allows partner API property imports with field mapping", () => {
    expect(() =>
      service.authorize(broker, {
        name: "properties.import",
        payload: {
          fieldMapping: {
            rootPath: "items",
            canonical: {
              externalId: "id",
              title: "name",
              market: "city",
              priceAmount: "price.sale",
              availableUntil: "availability.until"
            },
            customAttributes: [
              {
                key: "available_until_note",
                sourcePath: "availability.note",
                type: "text",
                filterHint: "availability"
              }
            ]
          },
          importMode: "concierge_index_only",
          objectUrl: "https://agency.example.com/feed.json",
          source: "partner-api",
          sourceConfigId: "source-1",
          tenantId: "demo-agency"
        }
      } satisfies EnqueueBackgroundJobRequest)
    ).not.toThrow();
  });

  it("allows XML property feed imports with field mapping", () => {
    expect(() =>
      service.authorize(broker, {
        name: "properties.import",
        payload: {
          fieldMapping: {
            rootPath: "listings.listing",
            canonical: {
              externalId: "id",
              title: "title",
              market: "city",
              priceAmount: "price.sale",
              availableUntil: "availability.until"
            },
            customAttributes: [
              {
                key: "availability_note",
                sourcePath: "availability.note",
                type: "text",
                filterHint: "availability"
              }
            ]
          },
          importMode: "concierge_index_only",
          objectUrl: "https://agency.example.com/feed.xml",
          source: "partner-xml",
          sourceConfigId: "source-xml",
          tenantId: "demo-agency"
        }
      } satisfies EnqueueBackgroundJobRequest)
    ).not.toThrow();
  });

  it("rejects partner API property imports without field mapping", () => {
    expect(() =>
      service.authorize(broker, {
        name: "properties.import",
        payload: {
          importMode: "concierge_index_only",
          objectUrl: "https://agency.example.com/feed.json",
          source: "partner-api",
          tenantId: "demo-agency"
        }
      } satisfies EnqueueBackgroundJobRequest)
    ).toThrow(BadRequestException);
  });

  it("rejects unknown property import modes", () => {
    expect(() =>
      service.authorize(broker, {
        name: "properties.import",
        payload: {
          importMode: "spreadsheet_magic",
          objectUrl: "data:text/csv;charset=utf-8,title",
          source: "csv",
          tenantId: "demo-agency"
        }
      } as unknown as EnqueueBackgroundJobRequest)
    ).toThrow(BadRequestException);
  });
});
