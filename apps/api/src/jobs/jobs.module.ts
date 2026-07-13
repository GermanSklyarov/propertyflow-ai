import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { AuthModule } from "../shared/auth/auth.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { TenantsModule } from "../tenants/tenants.module.js";
import { BackgroundJobPolicyService } from "./application/background-job-policy.service.js";
import { JobQueueService } from "./application/job-queue.service.js";
import { JobsController } from "./presentation/rest/jobs.controller.js";

@Module({
  imports: [AuditModule, AuthModule, RealtimeModule, StorageModule, TenantsModule],
  controllers: [JobsController],
  providers: [BackgroundJobPolicyService, JobQueueService],
  exports: [JobQueueService]
})
export class JobsModule {}
