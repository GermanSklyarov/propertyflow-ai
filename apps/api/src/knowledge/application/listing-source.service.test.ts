import { BadRequestException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    findById: vi.fn(),
    markSyncStarted: vi.fn()
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("previews a REST feed against canonical and custom mapping before saving", async () => {
    const { service } = createService();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            items: [
              {
                id: "p-1",
                name: "Jomtien yearly rental",
                city: "pattaya",
                sale_price: 2_900_000,
                rent_available_until: "2027-05-01",
                local: {
                  lease_note: "Available for 6 months only"
                }
              }
            ]
          }
        }),
        status: 200
      }))
    );

    await expect(
      service.preview("demo-agency", {
        name: "Agency feed",
        endpointUrl: "https://agency.co.th/api/listings",
        authType: "none",
        mapping: {
          rootPath: "data.items",
          canonical: {
            externalId: "id",
            title: "name",
            market: "city",
            priceAmount: "sale_price",
            availableUntil: "rent_available_until"
          },
          customAttributes: [
            {
              key: "lease_note",
              sourcePath: "local.lease_note",
              type: "text",
              filterHint: "contract_term"
            }
          ]
        }
      })
    ).resolves.toMatchObject({
      ok: true,
      itemCount: 1,
      sampleCount: 1,
      canonical: expect.arrayContaining([
        expect.objectContaining({
          field: "title",
          present: true,
          sampleValue: "Jomtien yearly rental"
        }),
        expect.objectContaining({
          field: "availableUntil",
          present: true,
          sampleValue: "2027-05-01"
        })
      ]),
      customAttributes: [
        expect.objectContaining({
          key: "lease_note",
          present: true,
          sampleValue: "Available for 6 months only"
        })
      ],
      missingRequiredFields: []
    });
  });

  it("previews an XML feed against canonical and custom mapping before saving", async () => {
    const { service } = createService();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => `
          <?xml version="1.0"?>
          <listings>
            <listing>
              <id>xml-1</id>
              <title>Jomtien yearly rental</title>
              <city>pattaya</city>
              <price>
                <sale>2900000</sale>
              </price>
              <availability>
                <until>2027-05-01</until>
                <note>Available for 6 months only</note>
              </availability>
            </listing>
          </listings>
        `
      }))
    );

    await expect(
      service.preview("demo-agency", {
        name: "Agency XML feed",
        type: "xml-feed",
        endpointUrl: "https://agency.co.th/feed.xml",
        authType: "none",
        mapping: {
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
              key: "lease_note",
              sourcePath: "availability.note",
              type: "text",
              filterHint: "contract_term"
            }
          ]
        }
      })
    ).resolves.toMatchObject({
      ok: true,
      itemCount: 1,
      sampleCount: 1,
      canonical: expect.arrayContaining([
        expect.objectContaining({
          field: "title",
          present: true,
          sampleValue: "Jomtien yearly rental"
        }),
        expect.objectContaining({
          field: "availableUntil",
          present: true,
          sampleValue: "2027-05-01"
        })
      ]),
      customAttributes: [
        expect.objectContaining({
          key: "lease_note",
          present: true,
          sampleValue: "Available for 6 months only"
        })
      ],
      missingRequiredFields: []
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://agency.co.th/feed.xml",
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: expect.stringContaining("application/xml")
        })
      })
    );
  });

  it("rejects preview when the root path does not resolve to listing rows", async () => {
    const { service } = createService();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            metadata: {
              count: 1
            }
          }
        }),
        status: 200
      }))
    );

    await expect(
      service.preview("demo-agency", {
        name: "Broken agency feed",
        endpointUrl: "https://agency.co.th/api/listings",
        mapping: {
          rootPath: "data.items",
          canonical: {
            title: "name",
            market: "city"
          }
        }
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("marks source syncing and queues REST source sync with field mapping", async () => {
    const { jobs, service, sources } = createService();
    const source = {
      id: "source-1",
      tenantId: "demo-agency",
      name: "REST feed",
      type: "rest-api" as const,
      endpointUrl: "https://agency.co.th/api/listings",
      authType: "none" as const,
      importMode: "concierge_index_only" as const,
      mapping: {
        canonical: {
          externalId: "id",
          title: "name"
        },
        customAttributes: [
          {
            key: "lease_available_until",
            sourcePath: "lease_until",
            type: "date" as const,
            filterHint: "availability" as const
          }
        ]
      },
      status: "connected" as const,
      lastError: "Previous sync failed",
      createdAt: "2026-07-29T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:00.000Z"
    };
    vi.mocked(sources.findById).mockResolvedValue({
      ...source
    });
    vi.mocked(sources.markSyncStarted).mockResolvedValue({
      ...source,
      status: "syncing",
      lastError: undefined,
      updatedAt: "2026-07-29T00:01:00.000Z"
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

    expect(sources.markSyncStarted).toHaveBeenCalledWith("demo-agency", "source-1");
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

  it("marks XML source syncing and queues XML feed import with field mapping", async () => {
    const { jobs, service, sources } = createService();
    const source = {
      id: "source-xml",
      tenantId: "demo-agency",
      name: "XML feed",
      type: "xml-feed" as const,
      endpointUrl: "https://agency.co.th/feed.xml",
      authType: "none" as const,
      importMode: "concierge_index_only" as const,
      mapping: {
        rootPath: "listings.listing",
        canonical: {
          externalId: "id",
          title: "title"
        },
        customAttributes: [
          {
            key: "available_until_note",
            sourcePath: "availability.note",
            type: "text" as const,
            filterHint: "availability" as const
          }
        ]
      },
      status: "connected" as const,
      createdAt: "2026-07-29T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:00.000Z"
    };
    vi.mocked(sources.findById).mockResolvedValue(source);
    vi.mocked(sources.markSyncStarted).mockResolvedValue({
      ...source,
      status: "syncing",
      updatedAt: "2026-07-29T00:01:00.000Z"
    });
    vi.mocked(jobs.enqueue).mockResolvedValue({
      id: "job-xml",
      name: "properties.import",
      queue: "propertyflow.jobs",
      status: "queued",
      tenantId: "demo-agency",
      createdAt: "2026-07-29T00:00:00.000Z"
    });

    await service.sync("demo-agency", "user-1", "source-xml");

    expect(jobs.enqueue).toHaveBeenCalledWith("properties.import", {
      tenantId: "demo-agency",
      requestedByUserId: "user-1",
      source: "partner-xml",
      importMode: "concierge_index_only",
      objectUrl: "https://agency.co.th/feed.xml",
      sourceConfigId: "source-xml",
      fieldMapping: source.mapping
    });
  });
});
