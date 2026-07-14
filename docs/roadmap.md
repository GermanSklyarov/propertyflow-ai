# PropertyFlow AI Roadmap

## Phase 0: Foundation

- Choose monorepo strategy.
- Define bounded contexts and initial architecture decisions.
- Add local infrastructure: PostgreSQL/PostGIS, Redis, OpenSearch, S3-compatible storage.
- Add shared domain vocabulary and first property search contracts.

## Phase 1: Backend Core

- Scaffold NestJS API.
- Add modular DDD structure.
- Add CQRS conventions.
- Add tenant, user, role, and agency concepts.
- Add audit/event outbox baseline.

## Phase 2: Property Inventory

- Add property aggregate and lifecycle.
- Add media, amenities, ownership, pricing, location, and availability.
- Add admin CRUD.
- Add import job contract.

## Phase 3: Search Intelligence

- Add structured property filters.
- Add natural-language query parser.
- Add OpenSearch indexing.
- Add pgvector-backed property embeddings for semantic matching.
- Add background embedding refresh jobs for imported and edited listings.
- Add hybrid ranking that combines structured filters, OpenSearch text score, pgvector similarity, and business signals.
- Add explainable result ranking.

## Phase 4: AI Advisor

- Generate listing summaries.
- Generate pros and cons.
- Extract features from images.
- Detect data quality issues.
- Add multilingual descriptions.

## Phase 5: Investment Intelligence

- Add rental assumptions.
- Add gross and net yield.
- Add payback period.
- Add ownership costs.
- Add sensitivity scenarios.

## Phase 6: Neighborhood Intelligence

- Add POI model.
- Add walkability scoring.
- Add lifestyle profile per area.
- Add map layers for beach, transport, schools, hospitals, shopping, and noise.

## Phase 7: Conversational Product

- Add RAG ingestion.
- Add AI chat over listings and knowledge base.
- Add property comparison.
- Add saved searches and recommendation loops.

## Phase 8: SaaS Operations

- Add custom domains and tenant branding.
- Add analytics dashboard.
- Add public REST API.
- Add WebSocket collaboration and task updates.
- Add billing-ready plan limits.

## Phase 9: Agency Growth Automation

- Add AI social post generation for LINE VOOM, Facebook, Instagram, and generic reposting workflows.
- Generate channel-specific captions, hooks, CTAs, hashtags, and short/long variants from listing data.
- Support multilingual post drafts in English, Russian, Thai, and Chinese.
- Reuse AI-selected gallery photos and image-analysis tags when composing posts.
- Add approval workflow: draft, review, approved, published.
- Track generated posts, source channels, UTM tags, leads, and conversion back to the listing and agent.
