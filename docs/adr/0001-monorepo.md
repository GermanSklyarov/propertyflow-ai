# ADR 0001: Start With A Monorepo

## Status

Accepted

## Context

PropertyFlow AI includes a public web app, admin app, backend API, workers, shared domain model, shared API contracts, and AI automation pipelines. These parts will change together while the product is being discovered.

## Decision

Use one monorepo named `propertyflow-ai`.

Initial workspace layout:

- `apps/api`
- `apps/web`
- `apps/admin`
- `apps/worker`
- `packages/domain`
- `packages/contracts`
- `packages/config`

## Consequences

Positive:

- Faster early iteration.
- Shared contracts and domain language.
- Easier cross-cutting refactors.
- One local development environment.

Tradeoffs:

- Requires workspace discipline.
- CI can become slower unless builds are cached.
- Service boundaries must be documented explicitly.

Future extraction is allowed when deployment, team ownership, or security boundaries justify it.

