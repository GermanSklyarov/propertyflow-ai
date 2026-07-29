import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { JobQueueService } from "../../jobs/application/job-queue.service.js";
import type { ListingSourceRepository } from "../domain/listing-source.repository.js";
import { ListingSourceService } from "./listing-source.service.js";

function createService() {
  const now = "2026-07-29T00:00:00.000Z";
  const sources = {
    save: vi.fn(async (tenantId, request) => ({
      id: "source-1",
      tenantId,
      name: request.name,
      type: request.type ?? "rest-api",
      endpointUrl: request.endpointUrl,
      authType: request.authType ?? "none",
      authHeaderName: request.authHeaderName,
      authSecretRef: request.authSecretRef,
      importMode: request.importMode ?? "hybrid",
      mapping: request.mapping,
      status: "draft",
      createdAt: now,
      updatedAt: now
    })),
    list: vi.fn(),
    findById: vi.fn()
  } as unknown as ListingSourceRepository;
  const jobs = {
    enqueue: vi.fn()
  } as unknown as JobQueueService;

  return {
    jobs,
    service: new ListingSourceService(sources, jobs),
    sources
  };
}

describe("ListingSourceService", () => {
  it("preserves canonical and custom mapped fields for Concierge retrieval", async () => {
    const { service, sources } = createService();

    await expect(
      service.create("demo-agency", {
        name: " Website REST feed ",
        endpointUrl: "https://agency.co.th/api/listings",
        mapping: {
          rootPath: "data.items",
          canonical: {
            externalId: "id",
            title: "name",
            market: "city",
            availableUntil: "rent_available_until"
          },
          customAttributes: [
            {
              key: " Rent Available Until ",
              sourcePath: "rent_available_until",
              type: "date",
              label: "Rent available until",
              description: "Do not recommend this listing for stays that end after this date.",
              filterHint: "availability"
            }
          ]
        }
      })
    ).resolves.toMatchObject({
      endpointUrl: "https://agency.co.th/api/listings",
      mapping: {
        canonical: {
          availableUntil: "rent_available_until"
        },
        customAttributes: [
          {
            key: "rent_available_until",
            sourcePath: "rent_available_until",
            type: "date",
            filterHint: "availability",
            searchable: true
          }
        ],
        rawPayloadMode: "store_selected"
      },
      name: "Website REST feed"
    });

    expect(sources.save).toHaveBeenCalledWith(
      "demo-agency",
      expect.objectContaining({
        importMode: "hybrid",
        mapping: expect.objectContaining({
          customAttributes: expect.arrayContaining([
            expect.objectContaining({
              description: "Do not recommend this listing for stays that end after this date.",
              filterHint: "availability"
            })
          ])
        })
      })
    );
  });

  it("rejects duplicate custom attribute keys before ingestion", async () => {
    const { service } = createService();

    await expect(
      service.create("demo-agency", {
        name: "Duplicate feed",
        endpointUrl: "https://agency.co.th/api/listings",
        mapping: {
          canonical: {
            externalId: "id"
          },
          customAttributes: [
            {
              key: "available until",
              sourcePath: "available_until",
              type: "date"
            },
            {
              key: "available_until",
              sourcePath: "rent_available_until",
              type: "date"
            }
          ]
        }
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("queues REST source sync with field mapping", async () => {
    const { jobs, service, sources } = createService();
    vi.mocked(sources.findById).mockResolvedValue({
      id: "source-1",
      tenantId: "demo-agency",
      name: "REST feed",
      type: "rest-api",
      endpointUrl: "https://agency.co.th/api/listings",
      authType: "none",
      importMode: "concierge_index_only",
      mapping: {
        canonical: {
          externalId: "id",
          title: "name"
        },
        customAttributes: [
          {
            key: "lease_available_until",
            sourcePath: "lease_until",
            type: "date",
            filterHint: "availability"
          }
        ]
      },
      status: "connected",
      createdAt: "2026-07-29T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:00.000Z"
    });
    vi.mocked(jobs.enqueue).mockResolvedValue({
      id: "job-1",
      name: "properties.import",
      queue: "propertyflow.jobs",
      status: "queued",
      tenantId: "demo-agency",
      createdAt: "2026-07-29T00:00:00.000Z"
    });

    await service.sync("demo-agency", "user-1", "source-1");

    expect(jobs.enqueue).toHaveBeenCalledWith("properties.import", {
      tenantId: "demo-agency",
      requestedByUserId: "user-1",
      source: "partner-api",
      importMode: "concierge_index_only",
      objectUrl: "https://agency.co.th/api/listings",
      sourceConfigId: "source-1",
      fieldMapping: {
        canonical: {
          externalId: "id",
          title: "name"
        },
        customAttributes: [
          {
            key: "lease_available_until",
            sourcePath: "lease_until",
            type: "date",
            filterHint: "availability"
          }
        ]
      }
    });
  });
});
