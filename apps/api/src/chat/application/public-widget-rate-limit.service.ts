import { HttpException, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";
import { loadAppConfig } from "@propertyflow/config";

export interface PublicWidgetRateLimitRequest {
  ip: string;
  sessionId?: string;
  tenantId: string;
}

interface RateLimitRule {
  key: string;
  limit: number;
  windowSeconds: number;
}

const rateLimitWindowSeconds = 60;
const publicWidgetAskLimits = {
  ipPerMinute: 20,
  sessionPerMinute: 10,
  tenantPerMinute: 100
};

@Injectable()
export class PublicWidgetRateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(PublicWidgetRateLimitService.name);
  private readonly localCounters = new Map<string, { count: number; expiresAt: number }>();
  private readonly redis = new Redis(loadAppConfig().redisUrl, {
    connectTimeout: 2_000,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1
  });

  constructor() {
    this.redis.on("error", (error) => {
      this.logger.warn(`Redis rate limit connection error: ${error.message}`);
    });
  }

  async checkPublicWidgetAsk(request: PublicWidgetRateLimitRequest): Promise<void> {
    const safeTenantId = rateLimitKeySegment(request.tenantId);
    const safeIp = rateLimitKeySegment(request.ip || "unknown");
    const safeSessionId = rateLimitKeySegment(request.sessionId || `${request.ip}:anonymous`);
    const rules: RateLimitRule[] = [
      {
        key: `public-widget:ask:tenant:${safeTenantId}:ip:${safeIp}`,
        limit: publicWidgetAskLimits.ipPerMinute,
        windowSeconds: rateLimitWindowSeconds
      },
      {
        key: `public-widget:ask:tenant:${safeTenantId}:session:${safeSessionId}`,
        limit: publicWidgetAskLimits.sessionPerMinute,
        windowSeconds: rateLimitWindowSeconds
      },
      {
        key: `public-widget:ask:tenant:${safeTenantId}`,
        limit: publicWidgetAskLimits.tenantPerMinute,
        windowSeconds: rateLimitWindowSeconds
      }
    ];

    await Promise.all(rules.map((rule) => this.consume(rule)));
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
  }

  private async consume(rule: RateLimitRule): Promise<void> {
    try {
      await this.consumeRedis(rule);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.warn(`Redis rate limit check failed for ${rule.key}: ${toErrorMessage(error)}`);
      this.consumeLocal(rule);
    }
  }

  private async consumeRedis(rule: RateLimitRule): Promise<void> {
    const count = await this.redis.incr(rule.key);

    if (count === 1) {
      await this.redis.expire(rule.key, rule.windowSeconds);
    }

    if (count > rule.limit) {
      throwRateLimitExceeded(rule.windowSeconds);
    }
  }

  private consumeLocal(rule: RateLimitRule): void {
    const now = Date.now();
    const current = this.localCounters.get(rule.key);
    const counter =
      current && current.expiresAt > now
        ? current
        : {
            count: 0,
            expiresAt: now + rule.windowSeconds * 1_000
          };

    counter.count += 1;
    this.localCounters.set(rule.key, counter);

    if (counter.count > rule.limit) {
      throwRateLimitExceeded(Math.max(1, Math.ceil((counter.expiresAt - now) / 1_000)));
    }
  }
}

function throwRateLimitExceeded(retryAfterSeconds: number): never {
  throw new HttpException(
    {
      message: "Too many AI Concierge requests. Please wait a moment and try again.",
      retryAfterSeconds,
      statusCode: 429
    },
    429
  );
}

function rateLimitKeySegment(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9:._-]+/g, "-").slice(0, 160) || "unknown";
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
