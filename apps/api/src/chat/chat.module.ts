import { forwardRef, Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";
import { LeadsModule } from "../leads/leads.module.js";
import { PropertiesModule } from "../properties/properties.module.js";
import { SearchObservabilityModule } from "../search-observability/search-observability.module.js";
import { AuthModule } from "../shared/auth/auth.module.js";
import { TenantsModule } from "../tenants/tenants.module.js";
import { NotificationProviderWebhookController } from "../tenants/presentation/rest/notification-provider-webhook.controller.js";
import { AI_TEXT_GENERATOR, OpenAiTextGenerator } from "./application/ai-text-generator.js";
import { AiChatService } from "./application/ai-chat.service.js";
import { LocationIntelligenceService } from "./application/location-intelligence.js";
import { PublicWidgetMessengerHandoffService } from "./application/public-widget-messenger-handoff.service.js";
import { PublicWidgetRateLimitService } from "./application/public-widget-rate-limit.service.js";
import { ChatController } from "./presentation/rest/chat.controller.js";
import { PublicWidgetChatController } from "./presentation/rest/public-widget-chat.controller.js";

@Module({
  imports: [
    AuditModule,
    AuthModule,
    DatabaseModule,
    KnowledgeModule,
    LeadsModule,
    PropertiesModule,
    SearchObservabilityModule,
    forwardRef(() => TenantsModule)
  ],
  controllers: [ChatController, NotificationProviderWebhookController, PublicWidgetChatController],
  providers: [
    AiChatService,
    LocationIntelligenceService,
    PublicWidgetMessengerHandoffService,
    PublicWidgetRateLimitService,
    { provide: AI_TEXT_GENERATOR, useClass: OpenAiTextGenerator }
  ],
  exports: [AiChatService, PublicWidgetMessengerHandoffService]
})
export class ChatModule {}
