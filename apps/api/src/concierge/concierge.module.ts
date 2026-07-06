import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { PropertiesModule } from "../properties/properties.module.js";
import { AuthModule } from "../shared/auth/auth.module.js";
import { TenantsModule } from "../tenants/tenants.module.js";
import { AiConciergeService } from "./application/ai-concierge.service.js";
import { ConciergeController } from "./presentation/rest/concierge.controller.js";

@Module({
  imports: [AuditModule, AuthModule, PropertiesModule, TenantsModule],
  controllers: [ConciergeController],
  providers: [AiConciergeService]
})
export class ConciergeModule {}
