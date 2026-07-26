create table if not exists agency_refresh_tokens (
  id uuid primary key,
  tenant_id text not null,
  user_id text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  replaced_by_token_id uuid,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, user_id) references tenant_users (tenant_id, id) on delete cascade,
  foreign key (tenant_id) references tenants (id) on delete cascade,
  foreign key (replaced_by_token_id) references agency_refresh_tokens (id)
);

create index if not exists idx_agency_refresh_tokens_active_lookup
  on agency_refresh_tokens (token_hash, expires_at)
  where revoked_at is null;

create index if not exists idx_agency_refresh_tokens_user
  on agency_refresh_tokens (tenant_id, user_id, created_at desc);
