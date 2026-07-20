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
