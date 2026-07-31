create table if not exists agency_email_tokens (
  id uuid primary key,
  tenant_id text not null references tenants (id) on delete cascade,
  email text not null,
  purpose text not null check (purpose in ('workspace-invitation', 'email-verification', 'magic-link')),
  token_hash text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_agency_email_tokens_active_lookup
  on agency_email_tokens (token_hash, expires_at)
  where consumed_at is null and revoked_at is null;

create index if not exists idx_agency_email_tokens_email_purpose
  on agency_email_tokens (tenant_id, lower(email), purpose, created_at desc);
