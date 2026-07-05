import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { PropertiesModule } from "../properties/properties.module.js";
import { SearchObservabilityModule } from "../search-observability/search-observability.module.js";
import { AuthModule } from "../shared/auth/auth.module.js";
import { TenantsModule } from "../tenants/tenants.module.js";
import { AiChatService } from "./application/ai-chat.service.js";
import { ChatController } from "./presentation/rest/chat.controller.js";

@Module({
  imports: [AuditModule, AuthModule, PropertiesModule, SearchObservabilityModule, TenantsModule],
  controllers: [ChatController],
  providers: [AiChatService]
})
export class ChatModule {}
