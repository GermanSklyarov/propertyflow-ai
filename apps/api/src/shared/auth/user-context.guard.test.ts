import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { RequestUser, TenantSnapshot, TenantUserSnapshot } from "@propertyflow/contracts";
import { UserContextGuard } from "./user-context.guard.js";

const tenant = {
  id: "tenant-1",
  name: "Tenant 1",
  slug: "tenant-1",
  status: "active",
  subscriptionPlan: "starter",
  widget: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
} as TenantSnapshot;

interface TestRequest {
  headers: Record<string, string | undefined>;
  tenant: TenantSnapshot;
  user?: RequestUser;
}

describe("UserContextGuard", () => {
  it("uses tenant membership as the source of truth for request user role", async () => {
    const member = tenantUser({ role: "manager" });
    const guard = createGuard(member);
    const request: TestRequest = {
      headers: {
        "x-user-id": member.id,
        "x-user-role": "manager"
      },
      tenant
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(request.user).toEqual({
      id: member.id,
      role: "manager",
      tenantId: tenant.id
    });
  });

  it("rejects role spoofing even when the user belongs to the tenant", async () => {
    const member = tenantUser({ role: "agent" });
    const guard = createGuard(member);

    await expect(
      guard.canActivate(
        createContext({
          headers: {
            "x-user-id": member.id,
            "x-user-role": "admin"
          },
          tenant
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects users without active membership in the selected tenant", async () => {
    const guard = createGuard(null);

    await expect(
      guard.canActivate(
        createContext({
          headers: {
            "x-user-id": "external-user"
          },
          tenant
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

function createGuard(member: TenantUserSnapshot | null) {
  return new UserContextGuard(
    {
      getRequestUserId: vi.fn((request: { headers: Record<string, string | undefined> }) => request.headers["x-user-id"])
    } as never,
    {
      getActiveTenantMember: vi.fn(async () => member)
    } as never
  );
}

function createContext(request: object) {
  return {
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as never;
}

function tenantUser(overrides: Partial<TenantUserSnapshot> = {}): TenantUserSnapshot {
  return {
    createdAt: new Date().toISOString(),
    email: "agent@example.com",
    id: "user-1",
    name: "Agent One",
    role: "agent",
    status: "active",
    tenantId: tenant.id,
    ...overrides
  };
}
