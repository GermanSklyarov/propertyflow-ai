import { describe, expect, it, vi } from "vitest";
import type { CreateLeadRequest, LeadSnapshot, RequestUser } from "@propertyflow/contracts";
import type { AuditService } from "../../audit/application/audit.service.js";
import type { PropertyRepository } from "../../properties/domain/property.repository.js";
import type { RealtimePublisherService } from "../../realtime/application/realtime-publisher.service.js";
import type { UserService } from "../../users/application/user.service.js";
import type { LeadRepository } from "../domain/lead.repository.js";
import { LeadService } from "./lead.service.js";

const user = {
  id: "manager-demo-1",
  role: "manager",
  tenantId: "demo-agency"
} satisfies RequestUser;

function createService(lead: LeadSnapshot) {
  const leads = {
    count: vi.fn().mockResolvedValue(1),
    create: vi.fn().mockResolvedValue(lead),
    list: vi.fn().mockResolvedValue([lead]),
    recordStatusEvent: vi.fn().mockResolvedValue({
      id: "status-event-1",
      leadId: lead.id,
      status: lead.status,
      tenantId: lead.tenantId
    })
  } as unknown as LeadRepository;
  const audit = {
    record: vi.fn().mockResolvedValue(undefined)
  } as unknown as AuditService;
  const realtime = {
    publish: vi.fn()
  } as unknown as RealtimePublisherService;

  return {
    audit,
    leads,
    realtime,
    service: new LeadService(
      leads,
      {} as PropertyRepository,
      audit,
      {} as UserService,
      realtime
    )
  };
}

describe("LeadService", () => {
  it("creates social-post leads with attribution metadata", async () => {
    const lead = {
      attributionSocialPostCampaign: "pattaya-sale-or-rent-property-1",
      attributionSocialPostChannel: "line-voom",
      attributionSocialPostTrackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en",
      contactEmail: "client@example.com",
      contactName: "LINE Client",
      createdAt: "2026-07-17T08:00:00.000Z",
      id: "lead-1",
      priority: "medium",
      propertyId: "property-1",
      source: "social-post",
      status: "new",
      tenantId: "demo-agency",
      updatedAt: "2026-07-17T08:00:00.000Z"
    } satisfies LeadSnapshot;
    const request = {
      attributionSocialPostCampaign: "pattaya-sale-or-rent-property-1",
      attributionSocialPostChannel: "line-voom",
      attributionSocialPostTrackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en",
      contactEmail: "client@example.com",
      contactName: "LINE Client",
      propertyId: "property-1",
      source: "social-post"
    } satisfies CreateLeadRequest;
    const { audit, leads, realtime, service } = createService(lead);

    const response = await service.create("demo-agency", request, user);

    expect(response).toEqual(lead);
    expect(leads.create).toHaveBeenCalledWith({
      ...request,
      tenantId: "demo-agency"
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "lead.created",
        metadata: expect.objectContaining({
          attributionSocialPostChannel: "line-voom",
          attributionSocialPostTrackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en",
          propertyId: "property-1",
          source: "social-post"
        })
      })
    );
    expect(realtime.publish).toHaveBeenCalledWith(
      "demo-agency",
      "lead.created",
      expect.objectContaining({
        attributionSocialPostChannel: "line-voom",
        attributionSocialPostTrackingSlug: "pattaya-sale-or-rent-property-1-line-voom-en",
        leadId: "lead-1",
        propertyId: "property-1",
        source: "social-post"
      })
    );
    expect(leads.recordStatusEvent).toHaveBeenCalledWith({
      leadId: "lead-1",
      status: "new",
      tenantId: "demo-agency",
      user
    });
  });

  it("lists social-post leads by property and tracking slug", async () => {
    const lead = {
      attributionSocialPostChannel: "facebook",
      attributionSocialPostTrackingSlug: "pattaya-sale-or-rent-property-1-facebook-en",
      contactEmail: "client@example.com",
      contactName: "Facebook Client",
      createdAt: "2026-07-17T08:10:00.000Z",
      id: "lead-2",
      priority: "medium",
      propertyId: "property-1",
      source: "social-post",
      status: "new",
      tenantId: "demo-agency",
      updatedAt: "2026-07-17T08:10:00.000Z"
    } satisfies LeadSnapshot;
    const { leads, service } = createService(lead);

    const response = await service.list(
      "demo-agency",
      {
        attributionSocialPostTrackingSlug: "pattaya-sale-or-rent-property-1-facebook-en",
        limit: 100,
        propertyId: "property-1",
        source: "social-post"
      },
      user
    );

    expect(response).toEqual({ items: [lead], total: 1 });
    expect(leads.count).toHaveBeenCalledWith("demo-agency", {
      attributionSocialPostTrackingSlug: "pattaya-sale-or-rent-property-1-facebook-en",
      limit: 100,
      propertyId: "property-1",
      source: "social-post"
    });
    expect(leads.list).toHaveBeenCalledWith("demo-agency", {
      attributionSocialPostTrackingSlug: "pattaya-sale-or-rent-property-1-facebook-en",
      limit: 100,
      propertyId: "property-1",
      source: "social-post"
    });
  });
});
