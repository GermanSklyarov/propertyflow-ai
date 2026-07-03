# PropertyFlow AI

AI-first real estate SaaS for Thailand property search, advisory, investment analysis, and agency operations.

The product is not a classic listing portal. Users describe a real-life goal in natural language, and the platform turns that intent into search, recommendations, comparisons, investment calculations, neighborhood intelligence, and chat grounded in the property database.

## Repository Strategy

Start with one monorepo named `propertyflow-ai`.

Why:

- shared domain model across API, workers, web app, admin, and AI services;
- shared contracts for REST/WebSocket/API clients;
- easier refactoring while the product shape is still changing;
- one local infrastructure stack for PostgreSQL/PostGIS, Redis, OpenSearch, object storage, and workers.

Possible future split:

- `propertyflow-ai-platform` for core SaaS;
- `propertyflow-ai-agents` for AI automation services;
- `propertyflow-ai-integrations` for import/export connectors;
- `propertyflow-ai-infra` for production infrastructure.

Do not split yet. The early cost of cross-repository coordination is higher than the benefit.

## Product Modules

- AI Search: natural language property search converted to structured filters and semantic ranking.
- AI Advisor: listing-level pros, cons, risks, lifestyle fit, and investment fit.
- Investment Calculator: ROI, yield, payback period, monthly ownership cost, taxes, fees, and rent forecast.
- Neighborhood Intelligence: beaches, transport, schools, hospitals, cafes, coworking, noise, tourism level, and walkability.
- AI Compare: compare properties for investment, living, family, relocation, and rental use cases.
- Interactive Map: PostGIS-backed map layers for lifestyle and infrastructure context.
- Price History: property and area price movement over time.
- Rental Yield: rent estimates, occupancy assumptions, net yield, and sensitivity analysis.
- AI Chat: RAG chat over listings, neighborhoods, articles, and Thailand relocation knowledge.
- Agent AI Tools: image analysis, OCR, multilingual descriptions, price recommendations, and import automation.
- Multi-Tenant SaaS: agency workspaces, branding, custom domains, RBAC, analytics, and public API.

## Technical Direction

- Backend: NestJS, DDD, CQRS, event-driven modules.
- Data: PostgreSQL, PostGIS, Redis, OpenSearch, vector storage, S3-compatible object storage.
- Async: BullMQ workers for imports, AI generation, OCR, image processing, indexing, and notifications.
- Realtime: WebSocket updates for listing status, tasks, leads, and agent collaboration.
- AI: provider abstraction for OpenAI, Anthropic, Gemini, OpenRouter, and local RAG pipelines.
- Frontend: public search app, admin app, and shared contracts.

## Workspace Layout

```txt
apps/
  api/       NestJS API and WebSocket gateway
  web/       Public buyer/investor experience
  admin/     Agency and platform admin experience
  worker/    BullMQ processors and scheduled jobs
packages/
  domain/    Core domain model and business rules
  contracts/ Shared API contracts and DTOs
  config/    Shared configuration helpers
docs/
  adr/       Architecture decision records
```

## Local Development

Create `.env` from `.env.example`, then start the local infrastructure and apply the first database migration.

```sh
npm install
npm run infra:up
npm run migrate
npm run dev --workspace @propertyflow/api
```

The API starts with a tenant-aware property inventory slice:

- `POST /properties`
- `POST /properties/ai-search`
- `GET /properties`
- `GET /properties/:propertyId`
- `GET /health`

All property routes require the `x-tenant-id` header.

`GET /properties` supports the first structured search filters:

- `market`
- `minPriceThb`
- `maxPriceThb`
- `minBedrooms`
- `minBathrooms`
- `minAreaSqm`
- `maxBeachDistanceMeters`
- `requiredAmenities=pool,gym,sea-view`
- `nearLatitude`, `nearLongitude`, `radiusMeters`

`POST /properties/ai-search` accepts natural-language intent and maps it to the structured filters above.

```json
{
  "locale": "ru",
  "query": "Ищу квартиру в Паттайе до 3 млн бат рядом с пляжем, бассейном и хорошим интернетом",
  "purpose": "living"
}
```

## First Milestones

1. Foundation: repository, architecture decisions, local infrastructure, domain vocabulary.
2. Backend Core: NestJS app, tenancy, auth skeleton, property module, CQRS conventions.
3. Property Data: PostgreSQL/PostGIS schema, listing CRUD, media model, status lifecycle.
4. Search: structured filters, OpenSearch indexing, semantic search query pipeline.
5. AI Advisor: listing summaries, pros/cons, image-derived features, explainable recommendations.
6. Investment: rental yield model, ROI calculator, assumptions, price history.
7. Neighborhood: POI ingestion, walkability scoring, map layers.
8. Chat/RAG: document ingestion, embeddings, retrieval, grounded answers.
9. Admin Automation: import jobs, AI description generation, OCR, translations, task monitoring.
10. SaaS Hardening: RBAC, custom domains, analytics, public API, audit log, billing-ready tenancy.
