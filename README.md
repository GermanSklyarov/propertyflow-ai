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
- AI Concierge: guided relocation intake that asks clarifying questions, recommends areas, and explains why listings fit or do not fit.
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
- `POST /properties/compare`
- `POST /properties/:propertyId/ai-assistant`
- `POST /properties/:propertyId/ai-assets/descriptions/:assetId/apply`
- `POST /properties/:propertyId/images/upload-url`
- `POST /properties/:propertyId/images/confirm-upload`
- `POST /properties/:propertyId/images`
- `POST /properties/:propertyId/images/:imageId/delete-preview`
- `DELETE /properties/:propertyId/images/:imageId`
- `POST /properties/:propertyId/images/:imageId/restore`
- `POST /properties/saved-searches`
- `GET /properties/saved-searches`
- `GET /properties/saved-searches/alerts`
- `GET /properties/saved-searches/alerts/runs`
- `GET /properties/saved-searches/alerts/runs/:runId`
- `POST /properties/saved-searches/alerts/digest-job`
- `GET /properties/saved-searches/:searchId`
- `GET /properties/saved-searches/:searchId/matches`
- `GET /properties/saved-searches/:searchId/recommendations`
- `PATCH /properties/saved-searches/:searchId/notifications`
- `DELETE /properties/saved-searches/:searchId`
- `POST /properties/:propertyId/publish`
- `PATCH /properties/:propertyId/price`
- `PATCH /properties/:propertyId/status`
- `POST /leads`
- `GET /leads/unassigned`
- `GET /leads/agents`
- `PATCH /leads/:leadId/assign`
- `GET /analytics/dashboard`
- `GET /analytics/security-events`
- `POST /analytics/security-events/:eventId/acknowledge`
- `GET /audit/events`
- `POST /chat`
- `POST /concierge/advise`
- `GET /concierge/analytics`
- `GET /concierge/model-registry`
- `POST /concierge/model/train`
- `GET /concierge/training-dataset`
- `GET /concierge/sessions`
- `POST /concierge/sessions`
- `POST /concierge/sessions/:sessionId/messages`
- `POST /concierge/sessions/:sessionId/lead`
- `POST /concierge/sessions/:sessionId/feedback`
- `GET /concierge/sessions/:sessionId`
- `GET /knowledge-documents`
- `GET /knowledge-documents/chunks/search`
- `POST /knowledge-documents`
- `POST /knowledge-documents/chunks/embed`
- `POST /knowledge-documents/:documentId/ingest`
- `GET /jobs`
- `POST /jobs`
- `GET /properties`
- `GET /properties/price-recommendation/model-registry`
- `GET /properties/price-recommendation/training-dataset`
- `POST /properties/price-recommendation/train`
- `GET /properties/search-index`
- `GET /properties/:propertyId/advisor`
- `GET /properties/:propertyId/ai-assets`
- `GET /properties/:propertyId/images`
- `GET /properties/:propertyId/investment`
- `GET /properties/:propertyId/neighborhood`
- `GET /properties/:propertyId/price-history`
- `GET /properties/:propertyId/price-recommendation`
- `POST /properties/:propertyId/price-recommendation/feedback`
- `GET /properties/:propertyId/rental-yield`
- `GET /properties/:propertyId/status-history`
- `GET /properties/:propertyId`
- `GET /tenants/current`
- `GET /tenants/current/usage`
- `PATCH /tenants/current/settings`
- `GET /public/v1/properties`
- `GET /public/v1/properties/:propertyId`
- `POST /public/v1/leads`
- `GET /health`

Swagger UI is available at `/docs`; the OpenAPI JSON document is available at `/docs-json`.

Realtime WebSocket namespace is `/realtime`. Clients can join a tenant room with `tenantId` in the handshake query or by sending `tenant.join`.

Realtime v1 emits:

- `property.created`
- `property.amenities_updated`
- `property.images_updated`
- `property.published`
- `property.price_updated`
- `property.status_changed`
- `lead.created`
- `lead.assigned`
- `security.event_detected`
- `security.event_acknowledged`
- `event`

Background jobs v1 use BullMQ with Redis. The API enqueues tenant-aware jobs through `POST /jobs`, and the worker processes them from the shared `propertyflow.jobs` queue. Direct job enqueueing is guarded by a job policy layer that checks the caller role, validates the payload against the selected job name, and rejects mismatched requests before they reach BullMQ.

`GET /jobs` returns tenant-scoped task monitoring data from BullMQ. It supports `states=waiting,active,completed,failed` and `limit=50`.

`POST /properties` also enqueues `properties.search.index` automatically after a listing is created.

`GET /properties/:propertyId/price-recommendation` returns an explainable pricing recommendation. The current engine is `baseline-comparables-v1`: it is not an ML model yet, but the response already includes `engine`, `modelVersion`, `trainingStatus`, `predictionTarget`, and `featuresUsed` so the endpoint can later switch to a trained pricing model without changing the product contract.

Supported job names:

- `knowledge.chunks.embed`
- `knowledge.documents.ingest`
- `concierge.model.train`
- `pricing.model.train`
- `properties.import`
- `properties.ai_description.generate`
- `properties.images.analyze`
- `saved_search.alerts.digest`
- `properties.search.index`

The search indexing job reads the property from PostgreSQL and writes an OpenSearch document to `propertyflow-properties-v1`. The index stores tenant, market, status, pricing, amenities, `geo_point` location, and a combined `searchableText` field for the next AI/search slice.

The knowledge ingestion job reads a tenant knowledge document, rebuilds `knowledge_document_chunks`, stores lexical search text, token estimates, tags, locale/kind metadata, and marks embeddings as `pending`. This keeps the Chat/RAG contract ready for a later embedding provider without changing the admin workflow.

`GET /knowledge-documents/chunks/search` returns scored tenant-isolated knowledge chunks from `knowledge_document_chunks`. Retrieval is `hybrid-chunks-v1`: lexical relevance plus cosine similarity for embedded chunks, with lexical fallback for chunks still marked `pending`. `POST /chat` uses the same retrieval path, so grounded answers cite the exact document chunk selected for context instead of scanning full raw documents.

`POST /knowledge-documents/chunks/embed` enqueues `knowledge.chunks.embed` for pending chunks. The current worker provider is `local-hash`, a deterministic vector prototype that updates `embedding`, `embedding_model`, and `embedding_status`; the API contract is shaped so OpenAI/Gemini/Anthropic embeddings can replace it later without changing admin workflows.

Run the worker locally with:

```sh
npm run dev --workspace @propertyflow/worker
```

With API and worker running, verify the full indexing path with:

```sh
npm run smoke:indexing --workspace @propertyflow/api
```

All tenant-aware routes require the `x-tenant-id` header. The API validates it against an active tenant record. Local development seeds `demo-agency`.

Routes with write or workspace-sensitive behavior also require dev RBAC headers:

- `x-user-id`
- `x-user-role`: `agent`, `broker`, `manager`, or `admin`

Current protected routes:

- `POST /chat`
- `GET /audit/events`
- `POST /concierge/advise`
- `GET /concierge/analytics`
- `GET /concierge/model-registry`
- `POST /concierge/model/train`
- `GET /concierge/training-dataset`
- `GET /concierge/sessions`
- `POST /concierge/sessions`
- `POST /concierge/sessions/:sessionId/messages`
- `POST /concierge/sessions/:sessionId/lead`
- `POST /concierge/sessions/:sessionId/feedback`
- `GET /concierge/sessions/:sessionId`
- `GET /knowledge-documents`
- `GET /knowledge-documents/chunks/search`
- `POST /knowledge-documents`
- `POST /knowledge-documents/chunks/embed`
- `POST /knowledge-documents/:documentId/ingest`
- `POST /properties`
- `POST /properties/ai-search`
- `POST /properties/compare`
- `GET /properties/price-recommendation/model-registry`
- `GET /properties/price-recommendation/training-dataset`
- `POST /properties/price-recommendation/train`
- `POST /properties/:propertyId/ai-assistant`
- `POST /properties/:propertyId/ai-assets/descriptions/:assetId/review`
- `POST /properties/:propertyId/ai-assets/descriptions/:assetId/apply`
- `POST /properties/:propertyId/ai-assets/image-analysis/:assetId/review`
- `POST /properties/:propertyId/ai-assets/image-analysis/:assetId/apply`
- `POST /properties/:propertyId/images/upload-url`
- `POST /properties/:propertyId/images/confirm-upload`
- `POST /properties/:propertyId/images`
- `POST /properties/:propertyId/images/:imageId/delete-preview`
- `DELETE /properties/:propertyId/images/:imageId`
- `POST /properties/:propertyId/images/:imageId/restore`
- `POST /properties/saved-searches`
- `GET /properties/saved-searches`
- `GET /properties/saved-searches/alerts`
- `GET /properties/saved-searches/alerts/runs`
- `GET /properties/saved-searches/alerts/runs/:runId`
- `POST /properties/saved-searches/alerts/digest-job`
- `GET /properties/saved-searches/:searchId`
- `GET /properties/saved-searches/:searchId/matches`
- `GET /properties/saved-searches/:searchId/recommendations`
- `PATCH /properties/saved-searches/:searchId/notifications`
- `DELETE /properties/saved-searches/:searchId`
- `POST /properties/:propertyId/publish`
- `PATCH /properties/:propertyId/price`
- `GET /properties/:propertyId/price-recommendation`
- `POST /properties/:propertyId/price-recommendation/feedback`
- `PATCH /properties/:propertyId/status`
- `GET /properties/:propertyId/status-history`
- `POST /leads`
- `GET /leads/unassigned`
- `GET /leads/agents`
- `PATCH /leads/:leadId/assign`
- `GET /analytics/dashboard`
- `GET /analytics/security-events`
- `POST /analytics/security-events/:eventId/acknowledge`
- `GET /jobs`
- `POST /jobs`
- `GET /tenants/current`
- `GET /tenants/current/usage`
- `PATCH /tenants/current/settings`

Audit log v1 records these actions:

- `chat.asked`
- `concierge.advised`
- `concierge.feedback_submitted`
- `concierge.lead_created`
- `concierge.message_added`
- `concierge.model_training_requested`
- `concierge.session_created`
- `concierge.training_dataset_viewed`
- `knowledge.document_created`
- `knowledge.document_embedding_requested`
- `knowledge.document_ingestion_requested`
- `pricing.model_training_requested`
- `property.created`
- `property.ai_assistant`
- `property.ai_asset_reviewed`
- `property.ai_description_applied`
- `property.ai_image_analysis_applied`
- `property.ai_search`
- `property.compared`
- `property.image_added`
- `property.image_delete_previewed`
- `property.image_removed`
- `property.image_restored`
- `property.published`
- `property.price_recommendation_feedback`
- `property.price_training_dataset_viewed`
- `property.price_recommended`
- `property.price_updated`
- `property.status_changed`
- `saved_search.created`
- `saved_search.deleted`
- `saved_search.alerts_viewed`
- `saved_search.alert_digest_requested`
- `saved_search.alert_run_viewed`
- `saved_search.alert_runs_viewed`
- `saved_search.matches_viewed`
- `saved_search.notifications_updated`
- `saved_search.recommendations_viewed`
- `saved_search.viewed`
- `tenant.current_viewed`
- `tenant.settings_updated`
- `lead.created`
- `lead.assigned`
- `job.enqueued`
- `job.enqueue_rejected`

`GET /audit/events` returns tenant-scoped audit events for manager/admin review, with optional `action`, `resourceType`, `resourceId`, `userId`, and `limit` filters.

`GET /properties` supports the first PostgreSQL-backed structured search filters:

- `market`
- `minPriceThb`
- `maxPriceThb`
- `minBedrooms`
- `minBathrooms`
- `minAreaSqm`
- `maxBeachDistanceMeters`
- `requiredAmenities=pool,gym,sea-view`
- `nearLatitude`, `nearLongitude`, `radiusMeters`

`GET /properties/search-index` searches OpenSearch index `propertyflow-properties-v1` with tenant isolation. It supports the same filters plus:

- `query`
- `limit`
- `offset`

Text search matches `title`, `address`, `description`, and `searchableText`, returns highlights, and keeps full listing details behind `GET /properties/:propertyId`.

`POST /properties/ai-search` accepts natural-language intent, maps it to structured filters, searches OpenSearch for ranking, and hydrates the ranked property IDs back from PostgreSQL.

```json
{
  "locale": "ru",
  "query": "Ищу квартиру в Паттайе до 3 млн бат рядом с пляжем, бассейном и хорошим интернетом",
  "purpose": "living"
}
```

`POST /concierge/advise` powers AI Concierge. The first call can contain a broad user message such as `"Переезжаю в Паттайю с семьей."`; the API returns a normalized profile and the most important follow-up questions. Once the profile includes budget, family/children, car, remote-work, purpose, and quiet preference, the response recommends an area such as Wongamat and ranks matching listings with reasons and tradeoffs.

`GET /concierge/analytics` returns the Concierge funnel: sessions, awaiting-input sessions, recommended sessions, `ai-concierge` leads, feedback count, recommendation rate, lead conversion rate, positive feedback rate, top purposes, markets, recommended areas, and ratings. `GET /concierge/model-registry` exposes the active advisory model metadata, and `POST /concierge/model/train` enqueues a BullMQ training job for the Concierge recommendation loop. `GET /concierge/training-dataset` exports ML/evaluation-ready rows with profile, recommendation, latest feedback, lead-conversion label, and selected property label. `GET /concierge/sessions` lists tenant consultations for an agent or manager dashboard with `status`, `userId`, and `limit` filters. `POST /concierge/sessions` starts a persisted concierge consultation. `POST /concierge/sessions/:sessionId/messages` appends follow-up answers, merges them into the saved profile, and stores both user and assistant turns in `concierge_messages`. `POST /concierge/sessions/:sessionId/lead` converts the recommendation into a CRM lead with source `ai-concierge`, defaulting to the top recommended listing when no property is specified. `POST /concierge/sessions/:sessionId/feedback` captures quality signals for the recommendation. `GET /concierge/sessions/:sessionId` returns the current profile, latest recommendation, and full message history.

`POST /properties/compare` compares 2-3 properties for investment, living, family, and relocation.

```json
{
  "propertyIds": [
    "property-id-1",
    "property-id-2",
    "property-id-3"
  ]
}
```

`POST /properties/saved-searches` saves a structured or natural-language search for the current user. Natural-language searches are interpreted into filters before saving, and the snapshot stores `matchCount`, `notificationsEnabled`, the original query, and filters. Agents see their own saved searches; broker/manager/admin roles can review tenant-level saved searches through `GET /properties/saved-searches`. `GET /properties/saved-searches/alerts` returns enabled saved-search alerts with current match counts and top recommendations, which gives notification workers a ready digest shape. `POST /properties/saved-searches/alerts/digest-job` enqueues `saved_search.alerts.digest` for the current user's enabled alerts, and the worker stores each completed digest in `saved_search_alert_runs`. `GET /properties/saved-searches/alerts/runs` returns recent digest runs for agent and manager dashboards; `GET /properties/saved-searches/alerts/runs/:runId` returns one run with its saved-search item breakdown. `GET /properties/saved-searches/:searchId/matches` reruns the saved filters and returns current matching listings for recommendation and notification workflows. `GET /properties/saved-searches/:searchId/recommendations` ranks the current matches and explains the top options with reasons and tradeoffs. `PATCH /properties/saved-searches/:searchId/notifications` enables or disables saved-search alerts without changing the search filters.

`POST /properties/:propertyId/ai-assistant` starts admin automation jobs for listing descriptions and image analysis. It can enqueue `properties.ai_description.generate` and `properties.images.analyze`, then those jobs are visible through `GET /jobs`. Image analysis jobs support `imageUrls` and optional matching `imageIds` for gallery-linked AI assets. The response includes `actionPolicy`, an explicit AI action allowlist decision for requested actions: background draft generation can be `allowed`, mutating actions such as applying AI output require human confirmation, and destructive actions such as `property.image.delete` are `blocked` so agents must use the guarded delete-preview plus confirmation-token flow.

`GET /properties/:propertyId/ai-assets` returns generated descriptions and image analysis results saved by the worker. Image analysis results include `propertyImageId` when the job was created from a gallery image.

`POST /properties/:propertyId/images/upload-url` returns a MinIO/S3 presigned `PUT` URL for direct browser uploads. `POST /properties/:propertyId/images/confirm-upload` stores the uploaded object in the listing gallery with bucket/object metadata and enqueues `properties.images.analyze` by default.

`GET /properties/:propertyId/images`, `POST /properties/:propertyId/images`, and `DELETE /properties/:propertyId/images/:imageId` manage the listing photo gallery with ordered image URLs, optional captions, audit/realtime events, and search reindexing. Destructive image deletion is guarded: clients must first call `POST /properties/:propertyId/images/:imageId/delete-preview`, show/verify the exact image, then pass the short-lived `confirmationToken` to `DELETE /properties/:propertyId/images/:imageId`. Deletes are soft-deletes and managers/admins can restore a removed image with `POST /properties/:propertyId/images/:imageId/restore`. Direct URL insertion remains useful for imports and partner feeds. Image analysis can be disabled per add/confirm request with `analyzeImage: false`.

`POST /properties/:propertyId/ai-assets/descriptions/:assetId/review` and `POST /properties/:propertyId/ai-assets/image-analysis/:assetId/review` approve or reject AI outputs before publication.

`POST /properties/:propertyId/ai-assets/descriptions/:assetId/apply` applies an approved AI description to the public listing title and description, then enqueues `properties.search.index` with `reason: "updated"` so OpenSearch can refresh the searchable document.

`POST /properties/:propertyId/publish` moves a draft listing to `status: "available"`, records audit/realtime events, and enqueues `properties.search.index` so public and indexed search can pick up the published state.

`PATCH /properties/:propertyId/price` updates the current listing price, records an `agent-update` price history point, emits audit/realtime events, and enqueues `properties.search.index`.

`PATCH /properties/:propertyId/status` changes operational listing status with transition validation, audit/realtime events, and search reindexing. Supported transitions are:

- `draft -> available | archived`
- `available -> reserved | sold | archived`
- `reserved -> available | sold | archived`
- `sold -> archived`
- `archived -> draft`

`GET /properties/:propertyId/status-history` returns the operational status timeline for one listing, including previous status, new status, user, role, optional note, and timestamp.

`GET /properties/:propertyId/advisor` returns a rule-based AI advisor summary:

- best fit: living, investment, relocation, family;
- pros;
- cons;
- risks;
- questions to ask the agent;
- confidence and source signals.

`GET /properties/:propertyId/investment` returns a v1 investment calculation:

- annual gross rent;
- known annual and monthly costs;
- gross yield;
- net yield;
- payback period;
- assumptions and warnings.

`GET /properties/:propertyId/neighborhood` returns a v1 neighborhood intelligence summary:

- walkability score;
- beach, restaurants, shopping, transport, hospitals, schools, coworking, and nightlife scores;
- nearest seed POIs;
- lifestyle signals.

`GET /properties/:propertyId/price-history` returns recorded price points, current price, change amount, change percent, trend, and a short summary. New listings automatically create an initial price history point.

`GET /properties/:propertyId/rental-yield` returns a compact yield summary for listing cards and search results:

- price;
- monthly rent estimate;
- annual gross rent;
- gross and net yield;
- confidence, label, summary, and warnings.

`GET /tenants/current` returns the active tenant workspace, branding, status, primary market, custom domain state, subscription plan, and usage limits for the supplied `x-tenant-id`. `GET /tenants/current/usage` returns current-month usage versus plan limits for properties, active users, AI-credit events, and public API requests. `PATCH /tenants/current/settings` lets managers/admins update branding, primary market, and custom domain; a new custom domain is marked `pending-verification`.

`GET /analytics/dashboard` returns tenant dashboard metrics: property counts, lead counts, unassigned leads, leads by source/status, search volume, average search latency, searches by source, top search queries, attributed leads, search-to-lead conversion rate, lead attribution by search source/query, basic conversion rate, AI Concierge adoption, Concierge lead conversion, feedback quality, recommendation areas, training label coverage, and a `security` block with rejected job enqueue attempts, blocked AI actions, image delete previews, image removals, rejected jobs by name, and blocked AI actions by name.

`GET /analytics/security-events` returns a manager/admin security feed normalized from audit events, including rejected job enqueue attempts, blocked AI actions, image delete previews, and confirmed image removals. It supports `kind`, `severity`, `userId`, `acknowledgement`, and `limit` filters for investigation workflows, and includes a `summary` with total matches plus severity/kind/acknowledgement buckets for the active filters. `POST /analytics/security-events/:eventId/acknowledge` marks a security event as handled with an optional note. Rejected job enqueue attempts and blocked AI actions emit realtime `security.event_detected` events; acknowledgements emit `security.event_acknowledged`.

Lead intake supports optional search attribution fields: `attributionSearchEventId`, `attributionSearchQuery`, and `attributionSearchSource`.

Public API v1 uses the `x-api-key` header. It is read-only for properties and supports lead intake. Successful requests are counted against `publicApiRequestsMonthly`; once the tenant reaches its monthly limit the API returns `429 Public API monthly request limit exceeded`. Local development seeds this demo key:

```txt
pf_demo_public_key
```

Public API v1 endpoints:

- `GET /public/v1/properties`
- `GET /public/v1/properties/:propertyId`
- `POST /public/v1/leads`

Public property reads only expose listings with `status: "available"`; draft, reserved, sold, and archived properties are hidden from public API consumers.

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
