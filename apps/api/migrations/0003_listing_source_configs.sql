create table if not exists listing_source_configs (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  name text not null,
  type text not null,
  endpoint_url text not null,
  auth_type text not null,
  auth_header_name text,
  auth_secret_ref text,
  import_mode text not null,
  mapping jsonb not null,
  status text not null,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_listing_source_configs_tenant_updated
  on listing_source_configs (tenant_id, updated_at desc);

create unique index if not exists idx_listing_source_configs_tenant_name
  on listing_source_configs (tenant_id, lower(name));
