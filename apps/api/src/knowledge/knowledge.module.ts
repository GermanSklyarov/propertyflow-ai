import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { AuthModule } from "../shared/auth/auth.module.js";
import { TenantsModule } from "../tenants/tenants.module.js";
import { KnowledgeDocumentService } from "./application/knowledge-document.service.js";
import { KNOWLEDGE_DOCUMENT_REPOSITORY } from "./domain/knowledge-document.repository.js";
import { PgKnowledgeDocumentRepository } from "./infrastructure/postgres/pg-knowledge-document.repository.js";
import { KnowledgeDocumentsController } from "./presentation/rest/knowledge-documents.controller.js";

@Module({
  imports: [AuditModule, AuthModule, DatabaseModule, TenantsModule],
  controllers: [KnowledgeDocumentsController],
  providers: [
    KnowledgeDocumentService,
    {
      provide: KNOWLEDGE_DOCUMENT_REPOSITORY,
      useClass: PgKnowledgeDocumentRepository
    }
  ],
  exports: [KnowledgeDocumentService]
})
export class KnowledgeModule {}
