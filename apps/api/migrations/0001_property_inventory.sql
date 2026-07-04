create extension if not exists postgis;

create table if not exists tenants (
  id text primary key,
  name text not null,
  slug text not null unique,
  status text not null,
  primary_market text,
  branding_display_name text not null,
  branding_primary_color text,
  branding_logo_url text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

insert into tenants (
  id,
  name,
  slug,
  status,
  primary_market,
  branding_display_name,
  branding_primary_color,
  branding_logo_url,
  created_at,
  updated_at
) values (
  'demo-agency',
  'Demo Agency',
  'demo-agency',
  'active',
  'pattaya',
  'Demo Agency',
  '#0f766e',
  null,
  now(),
  now()
) on conflict (id) do nothing;

create table if not exists properties (
  id uuid primary key,
  tenant_id text not null,
  title text not null,
  description text,
  kind text not null,
  market text not null,
  status text not null,
  price_amount numeric(14, 2) not null,
  price_currency text not null,
  location geography(point, 4326) not null,
  latitude double precision not null,
  longitude double precision not null,
  address text,
  bedrooms integer not null,
  bathrooms integer not null,
  area_sqm numeric(10, 2) not null,
  floor integer,
  beach_distance_meters integer,
  monthly_rent_estimate_amount numeric(14, 2),
  monthly_rent_estimate_currency text,
  maintenance_fee_monthly_amount numeric(14, 2),
  maintenance_fee_monthly_currency text,
  amenities text[] not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_properties_tenant_status on properties (tenant_id, status);
create index if not exists idx_properties_tenant_market on properties (tenant_id, market);
create index if not exists idx_properties_location on properties using gist (location);
create index if not exists idx_properties_price_amount on properties (price_amount);

create table if not exists property_price_history (
  id uuid primary key,
  tenant_id text not null,
  property_id uuid not null references properties(id) on delete cascade,
  price_amount numeric(14, 2) not null,
  price_currency text not null,
  source text not null,
  effective_date timestamptz not null
);

create index if not exists idx_property_price_history_property on property_price_history (tenant_id, property_id, effective_date);

create table if not exists audit_events (
  id uuid primary key,
  tenant_id text not null,
  user_id text,
  user_role text,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null
);

create index if not exists idx_audit_events_tenant_created on audit_events (tenant_id, created_at desc);
create index if not exists idx_audit_events_action on audit_events (action);

create table if not exists api_keys (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  status text not null,
  scopes text[] not null default '{}',
  created_at timestamptz not null,
  last_used_at timestamptz
);

insert into api_keys (
  id,
  tenant_id,
  name,
  key_prefix,
  key_hash,
  status,
  scopes,
  created_at,
  last_used_at
) values (
  '11111111-1111-4111-8111-111111111111',
  'demo-agency',
  'Demo Public API Key',
  'pf_demo',
  '4dcc05bed1685cd17afcfdfb499497e980b89048c0c4a1219262fdb5043ce74b',
  'active',
  array['properties:read'],
  now(),
  null
) on conflict (id) do nothing;

create index if not exists idx_api_keys_tenant_status on api_keys (tenant_id, status);
