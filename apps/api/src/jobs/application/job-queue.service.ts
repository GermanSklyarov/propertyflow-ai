import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import {
  type BackgroundJobName,
  type BackgroundJobMonitorItem,
  type BackgroundJobMonitorResponse,
  type BackgroundJobState,
  type BackgroundJobPayload,
  type BackgroundJobSnapshot,
  PROPERTYFLOW_JOBS_QUEUE
} from "@propertyflow/contracts";
import { loadAppConfig } from "@propertyflow/config";

@Injectable()
export class JobQueueService implements OnModuleDestroy {
  private readonly connection = new Redis(loadAppConfig().redisUrl, {
    maxRetriesPerRequest: null
  });

  private readonly queue = new Queue<BackgroundJobPayload, unknown, BackgroundJobName>(PROPERTYFLOW_JOBS_QUEUE, {
    connection: this.connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5_000
      },
      removeOnComplete: 500,
      removeOnFail: 1_000
    }
  });

  async enqueue(name: BackgroundJobName, payload: BackgroundJobPayload): Promise<BackgroundJobSnapshot> {
    const job = await this.queue.add(name, payload);

    return {
      id: String(job.id),
      name,
      queue: PROPERTYFLOW_JOBS_QUEUE,
      status: "queued",
      tenantId: payload.tenantId,
      createdAt: new Date().toISOString()
    };
  }

  async list(tenantId: string, states: BackgroundJobState[], limit = 50): Promise<BackgroundJobMonitorResponse> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const jobs = await this.queue.getJobs(states, 0, boundedLimit - 1, true);
    const items = await Promise.all(
      jobs
        .filter((job) => job.data.tenantId === tenantId)
        .map(async (job): Promise<BackgroundJobMonitorItem> => {
          const state = await job.getState();

          return {
            id: String(job.id),
            name: job.name,
            queue: PROPERTYFLOW_JOBS_QUEUE,
            state: isBackgroundJobState(state) ? state : "unknown",
            tenantId: job.data.tenantId,
            requestedByUserId: job.data.requestedByUserId,
            attemptsMade: job.attemptsMade,
            progress: job.progress,
            createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : undefined,
            processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
            finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
            failedReason: job.failedReason,
            payload: job.data,
            result: job.returnvalue
          };
        })
    );

    return {
      items,
      total: items.length,
      states
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    this.connection.disconnect();
  }
}

function isBackgroundJobState(value: string): value is BackgroundJobState {
  return [
    "active",
    "completed",
    "delayed",
    "failed",
    "paused",
    "prioritized",
    "waiting",
    "waiting-children"
  ].includes(value);
}
