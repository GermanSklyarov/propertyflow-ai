import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import {
  type BackgroundJobName,
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

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    this.connection.disconnect();
  }
}
