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

create table if not exists tenant_users (
  id text not null,
  tenant_id text not null references tenants(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null,
  status text not null,
  created_at timestamptz not null,
  primary key (tenant_id, id)
);

insert into tenant_users (
  id,
  tenant_id,
  name,
  email,
  role,
  status,
  created_at
) values
  ('agent-demo-1', 'demo-agency', 'Demo Agent', 'agent@propertyflow.local', 'agent', 'active', now()),
  ('manager-demo-1', 'demo-agency', 'Demo Manager', 'manager@propertyflow.local', 'manager', 'active', now())
on conflict (tenant_id, id) do nothing;

create index if not exists idx_tenant_users_tenant_role on tenant_users (tenant_id, role, status);

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

create table if not exists property_images (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  image_url text not null,
  bucket text,
  object_key text,
  mime_type text,
  size_bytes integer,
  original_filename text,
  caption text,
  position integer not null default 0,
  created_at timestamptz not null
);

alter table property_images add column if not exists bucket text;
alter table property_images add column if not exists object_key text;
alter table property_images add column if not exists mime_type text;
alter table property_images add column if not exists size_bytes integer;
alter table property_images add column if not exists original_filename text;

create index if not exists idx_property_images_property on property_images (tenant_id, property_id, position, created_at);
create index if not exists idx_property_images_object_key on property_images (tenant_id, object_key);

create table if not exists property_status_events (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  previous_status text not null,
  status text not null,
  changed_by_user_id text,
  changed_by_user_role text,
  note text,
  created_at timestamptz not null
);

create index if not exists idx_property_status_events_property on property_status_events (tenant_id, property_id, created_at);
create index if not exists idx_property_status_events_status on property_status_events (tenant_id, status, created_at desc);

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

create table if not exists property_generated_descriptions (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  locale text not null,
  title text not null,
  description text not null,
  source text not null,
  review_status text not null default 'draft',
  reviewed_by_user_id text,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null
);

alter table property_generated_descriptions add column if not exists review_status text not null default 'draft';
alter table property_generated_descriptions add column if not exists reviewed_by_user_id text;
alter table property_generated_descriptions add column if not exists reviewed_at timestamptz;
alter table property_generated_descriptions add column if not exists review_note text;

create index if not exists idx_property_generated_descriptions_property on property_generated_descriptions (tenant_id, property_id, locale);
create index if not exists idx_property_generated_descriptions_review on property_generated_descriptions (tenant_id, review_status);

create table if not exists property_image_analysis (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  property_image_id uuid references property_images(id) on delete set null,
  image_url text not null,
  detected_features text[] not null default '{}',
  confidence numeric(4, 3) not null,
  review_status text not null default 'draft',
  reviewed_by_user_id text,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null
);

alter table property_image_analysis add column if not exists property_image_id uuid references property_images(id) on delete set null;
alter table property_image_analysis add column if not exists review_status text not null default 'draft';
alter table property_image_analysis add column if not exists reviewed_by_user_id text;
alter table property_image_analysis add column if not exists reviewed_at timestamptz;
alter table property_image_analysis add column if not exists review_note text;

create index if not exists idx_property_image_analysis_property on property_image_analysis (tenant_id, property_id);
create index if not exists idx_property_image_analysis_property_image on property_image_analysis (tenant_id, property_image_id);
create index if not exists idx_property_image_analysis_review on property_image_analysis (tenant_id, review_status);

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

create table if not exists search_events (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  user_id text,
  user_role text,
  source text not null,
  query text,
  filters jsonb not null default '{}'::jsonb,
  total_results integer not null,
  latency_ms integer not null,
  created_at timestamptz not null
);

create index if not exists idx_search_events_tenant_created on search_events (tenant_id, created_at desc);
create index if not exists idx_search_events_tenant_source on search_events (tenant_id, source);
create index if not exists idx_search_events_tenant_query on search_events (tenant_id, query);

create table if not exists knowledge_documents (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  title text not null,
  body text not null,
  locale text not null,
  kind text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_knowledge_documents_tenant_locale on knowledge_documents (tenant_id, locale, kind);
create index if not exists idx_knowledge_documents_tenant_updated on knowledge_documents (tenant_id, updated_at desc);
create index if not exists idx_knowledge_documents_tags on knowledge_documents using gin (tags);

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
  array['properties:read', 'leads:write'],
  now(),
  null
) on conflict (id) do nothing;

create index if not exists idx_api_keys_tenant_status on api_keys (tenant_id, status);

create table if not exists leads (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  source text not null,
  status text not null,
  contact_name text not null,
  contact_email text,
  contact_phone text,
  message text,
  preferred_locale text,
  assigned_agent_id text,
  attribution_search_event_id uuid,
  attribution_search_query text,
  attribution_search_source text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

alter table leads add column if not exists attribution_search_event_id uuid;
alter table leads add column if not exists attribution_search_query text;
alter table leads add column if not exists attribution_search_source text;

create index if not exists idx_leads_tenant_status on leads (tenant_id, status);
create index if not exists idx_leads_tenant_property on leads (tenant_id, property_id);
create index if not exists idx_leads_tenant_created on leads (tenant_id, created_at desc);
create index if not exists idx_leads_tenant_assigned_agent on leads (tenant_id, assigned_agent_id);
create index if not exists idx_leads_tenant_attribution_source on leads (tenant_id, attribution_search_source);
create index if not exists idx_leads_tenant_attribution_query on leads (tenant_id, attribution_search_query);
