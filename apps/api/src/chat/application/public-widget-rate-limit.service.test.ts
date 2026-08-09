import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicWidgetRateLimitService } from "./public-widget-rate-limit.service.js";

const redisCounts = new Map<string, number>();
let rejectRedisCommands = false;

vi.mock("@propertyflow/config", () => ({
  loadAppConfig: () => ({
    redisUrl: "redis://localhost:6379"
  })
}));

vi.mock("ioredis", () => ({
  Redis: class RedisMock {
    disconnect = vi.fn();
    expire = vi.fn().mockResolvedValue(1);
    on = vi.fn();

    async incr(key: string) {
      if (rejectRedisCommands) {
        throw new Error("redis unavailable");
      }

      const next = (redisCounts.get(key) ?? 0) + 1;
      redisCounts.set(key, next);

      return next;
    }
  }
}));

describe("PublicWidgetRateLimitService", () => {
  beforeEach(() => {
    redisCounts.clear();
    rejectRedisCommands = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("limits public widget ask requests per session", async () => {
    const service = new PublicWidgetRateLimitService();
    const request = {
      ip: "203.0.113.10",
      sessionId: "session-1",
      tenantId: "tenant-1"
    };

    for (let index = 0; index < 10; index += 1) {
      await expect(service.checkPublicWidgetAsk(request)).resolves.toBeUndefined();
    }

    await expect(service.checkPublicWidgetAsk(request)).rejects.toMatchObject({
      status: 429
    });
  });

  it("uses local counters when Redis is unavailable", async () => {
    rejectRedisCommands = true;
    const service = new PublicWidgetRateLimitService();
    const request = {
      ip: "203.0.113.10",
      sessionId: "session-1",
      tenantId: "tenant-1"
    };

    for (let index = 0; index < 10; index += 1) {
      await expect(service.checkPublicWidgetAsk(request)).resolves.toBeUndefined();
    }

    await expect(service.checkPublicWidgetAsk(request)).rejects.toMatchObject({
      status: 429
    });
  });
});
