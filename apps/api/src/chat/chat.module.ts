import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";
import { LeadsModule } from "../leads/leads.module.js";
import { PropertiesModule } from "../properties/properties.module.js";
import { SearchObservabilityModule } from "../search-observability/search-observability.module.js";
import { AuthModule } from "../shared/auth/auth.module.js";
import { TenantsModule } from "../tenants/tenants.module.js";
import { AiChatService } from "./application/ai-chat.service.js";
import { ChatController } from "./presentation/rest/chat.controller.js";
import { PublicWidgetChatController } from "./presentation/rest/public-widget-chat.controller.js";

@Module({
  imports: [AuditModule, AuthModule, KnowledgeModule, LeadsModule, PropertiesModule, SearchObservabilityModule, TenantsModule],
  controllers: [ChatController, PublicWidgetChatController],
  providers: [AiChatService]
})
export class ChatModule {}
