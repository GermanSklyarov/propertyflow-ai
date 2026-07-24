# Starter Launch Plan

This plan keeps Starter focused on a sellable agency entry point: AI Concierge first, CRM later.

## Product Positioning

Starter is not a lightweight CRM. It is the fastest path for an agency to add a knowledgeable AI property consultant to its existing website.

The promised first-run outcome:

1. Agency creates a workspace.
2. Agency selects the Starter plan.
3. Agency uploads knowledge and imports listing sources.
4. PropertyFlowAI indexes the sources.
5. Agency copies one widget snippet to its website.
6. Visitors can ask the AI Concierge questions grounded in agency-approved knowledge and listings.

CRM remains optional in Starter. Growth and Enterprise unlock lead handoff, assignment, pipeline, SLA, automation, and analytics.

## Launch Gate

Starter is launch-ready only when all items below are true:

- A new agency can register or be provisioned without manual database edits.
- A tenant has an explicit subscription plan, usage limits, and Starter feature flags.
- The first screen explains the setup path: Knowledge Sources, AI Concierge personality, website widget, readiness.
- Knowledge Sources support documents and property listings as first-class AI inputs.
- Imported listings can feed Concierge search without forcing CRM inventory adoption.
- Widget install readiness has actionable blockers and no dead links.
- Public widget config and chat endpoints are tenant-scoped, origin-aware, localized, and covered by tests.
- Local demo data looks production-like: tenant settings, knowledge sources, listings, projects, media, and optional CRM examples.
- UI empty/error states replace fallback demo cards when backend data is missing.
- README has one command path for running infra, migrations, seed data, API, worker, web, and agency app.

## Workstreams

### 1. Signup And Plan Entry

- Add a tenant provisioning flow for local and future hosted environments.
- Define Starter, Growth, and Enterprise plan contracts in the domain/contracts package.
- Store subscription plan, status, and limits on the tenant.
- Add plan-aware UI so Starter hides CRM-heavy navigation by default.
- Add an upgrade path from Starter to Growth without data migration surprises.

### 2. First-Run Setup Wizard

- Build a setup page for new tenants:
  - agency profile;
  - plan confirmation;
  - Knowledge Sources;
  - AI personality and languages;
  - website origins;
  - widget snippet.
- Persist progress so an agency can leave and continue later.
- Reuse current settings/knowledge widgets instead of duplicating form logic.

### 3. Knowledge Sources As The Center

- Keep one source model for documents, listing feeds, website pages, and external sources.
- Add source statuses: draft, connected, indexing, ready, failed, disabled.
- Add source modes:
  - `concierge_index_only`;
  - `crm_inventory`;
  - `hybrid`.
- Make the ingestion pipeline visible: Source -> Ingestion -> Parsing/Chunking -> Embeddings -> Retrieval.
- Add tests around tenant isolation, source mode behavior, and failed ingestion states.

### 4. Property Listings Without CRM Migration

- Strengthen CSV import with mapping, validation, preview, and background progress.
- Add REST/XML feed contracts for agencies that already have inventory elsewhere.
- Index imported listings for Concierge even when CRM inventory is disabled.
- Keep canonical project and amenity normalization/deduplication in the ingestion path.

### 5. Widget Production Readiness

- Make install snippet copyable and localized.
- Support `data-locale="auto"` plus fixed locale for localized agency pages.
- Add origin allowlist checks and clear test/live mode labels.
- Add a public widget smoke-check flow that validates script presence and tenant slug.
- Add a demo host page for the widget so sales demos do not depend on a real agency site.

### 6. Local Demo Dataset

- Move essential fake UI fallbacks into seed data.
- Seed:
  - tenant plan and widget settings;
  - realistic knowledge documents;
  - indexing jobs/chunks where useful;
  - property sources and imported listing examples;
  - projects, amenities, media, and property gallery data;
  - optional Growth CRM leads for upgrade demos.
- Keep demo data deterministic and resettable with `npm run seed:demo`.

### 7. Production-Like Polish

- Replace fallback cards with loading, empty, and error states.
- Remove obvious smoke-test labels from visible demo UI where they hurt credibility.
- Audit all Starter pages for mobile/desktop layout.
- Add focused tests for every API touched during launch work.
- Add a launch checklist in README with exact local commands.

## Suggested Implementation Order

1. Document the Starter launch gate and split roadmap work by sellable milestones.
2. Add plan contracts and tenant provisioning defaults.
3. Seed production-like Starter data for `demo-agency`.
4. Build the first-run setup shell using existing Knowledge/Settings widgets.
5. Tighten Knowledge Sources ingestion states and remove fallback demo UI.
6. Add widget demo page and install smoke-check flow.
7. Add CRM upgrade path indicators without exposing CRM as the Starter core.

