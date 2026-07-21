create extension if not exists postgis;

create table if not exists tenants (
  id text primary key,
  name text not null,
  slug text not null unique,
  status text not null,
  primary_market text,
  custom_domain text,
  domain_status text not null default 'not-configured',
  subscription_plan text not null default 'starter',
  limits jsonb not null default '{"properties":100,"agents":5,"aiCreditsMonthly":1000,"publicApiRequestsMonthly":10000}'::jsonb,
  branding_display_name text not null,
  branding_primary_color text,
  branding_logo_url text,
  widget_ai_name text not null default 'Anna',
  widget_ai_names jsonb not null default '{"en":"Anna","ru":"Анна","th":"มาลี","zh":"安娜"}'::jsonb,
  widget_welcome_message text not null default 'Hi! I''m Anna, your AI property consultant.',
  widget_welcome_messages jsonb not null default '{"en":"Hi! I''m Anna, your AI property consultant.","ru":"Привет! Я Анна, ваш AI-консультант по недвижимости.","th":"สวัสดีค่ะ ฉันชื่อ Anna ผู้ช่วย AI ด้านอสังหาริมทรัพย์ของคุณ","zh":"你好！我是 Anna，你的 AI 房产顾问。"}'::jsonb,
  widget_persona_genders jsonb not null default '{"en":"feminine","ru":"feminine","th":"feminine","zh":"neutral"}'::jsonb,
  widget_tone text not null default 'friendly',
  widget_languages text[] not null default array['en','ru','th','zh'],
  created_at timestamptz not null,
  updated_at timestamptz not null
);

alter table tenants add column if not exists custom_domain text;
alter table tenants add column if not exists domain_status text not null default 'not-configured';
alter table tenants add column if not exists subscription_plan text not null default 'starter';
alter table tenants add column if not exists limits jsonb not null default '{"properties":100,"agents":5,"aiCreditsMonthly":1000,"publicApiRequestsMonthly":10000}'::jsonb;
alter table tenants add column if not exists widget_ai_name text not null default 'Anna';
alter table tenants add column if not exists widget_ai_names jsonb not null default '{"en":"Anna","ru":"Анна","th":"มาลี","zh":"安娜"}'::jsonb;
alter table tenants add column if not exists widget_welcome_message text not null default 'Hi! I''m Anna, your AI property consultant.';
alter table tenants add column if not exists widget_welcome_messages jsonb not null default '{"en":"Hi! I''m Anna, your AI property consultant.","ru":"Привет! Я Анна, ваш AI-консультант по недвижимости.","th":"สวัสดีค่ะ ฉันชื่อ Anna ผู้ช่วย AI ด้านอสังหาริมทรัพย์ของคุณ","zh":"你好！我是 Anna，你的 AI 房产顾问。"}'::jsonb;
alter table tenants add column if not exists widget_persona_genders jsonb not null default '{"en":"feminine","ru":"feminine","th":"feminine","zh":"neutral"}'::jsonb;
alter table tenants add column if not exists widget_tone text not null default 'friendly';
alter table tenants add column if not exists widget_languages text[] not null default array['en','ru','th','zh'];
create unique index if not exists idx_tenants_custom_domain on tenants (custom_domain) where custom_domain is not null;

insert into tenants (
  id,
  name,
  slug,
  status,
  primary_market,
  custom_domain,
  domain_status,
  subscription_plan,
  limits,
  branding_display_name,
  branding_primary_color,
  branding_logo_url,
  widget_ai_name,
  widget_ai_names,
  widget_welcome_message,
  widget_welcome_messages,
  widget_persona_genders,
  widget_tone,
  widget_languages,
  created_at,
  updated_at
) values (
  'demo-agency',
  'Demo Agency',
  'demo-agency',
  'active',
  'pattaya',
  null,
  'not-configured',
  'growth',
  '{"properties":500,"agents":25,"aiCreditsMonthly":10000,"publicApiRequestsMonthly":100000}'::jsonb,
  'Demo Agency',
  '#0f766e',
  null,
  'Anna',
  '{"en":"Anna","ru":"Анна","th":"มาลี","zh":"安娜"}'::jsonb,
  'Hi! I''m Anna, your AI property consultant.',
  '{"en":"Hi! I''m Anna, your AI property consultant.","ru":"Привет! Я Анна, ваш AI-консультант по недвижимости.","th":"สวัสดีค่ะ ฉันชื่อ Anna ผู้ช่วย AI ด้านอสังหาริมทรัพย์ของคุณ","zh":"你好！我是 Anna，你的 AI 房产顾问。"}'::jsonb,
  '{"en":"feminine","ru":"feminine","th":"feminine","zh":"neutral"}'::jsonb,
  'friendly',
  array['en','ru','th','zh'],
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

create table if not exists property_projects (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  market text not null,
  status text not null default 'completed',
  developer text,
  address text,
  completion_year integer,
  location geography(point, 4326),
  latitude double precision,
  longitude double precision,
  amenities text[] not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

alter table property_projects add column if not exists status text not null default 'completed';
alter table property_projects add column if not exists normalized_name text;
alter table property_projects add column if not exists developer text;
alter table property_projects add column if not exists address text;
alter table property_projects add column if not exists completion_year integer;
alter table property_projects add column if not exists location geography(point, 4326);
alter table property_projects add column if not exists latitude double precision;
alter table property_projects add column if not exists longitude double precision;
alter table property_projects add column if not exists amenities text[] not null default '{}';

update property_projects
set normalized_name = regexp_replace(
  regexp_replace(lower(replace(name, '&', 'and')), '\m(the|condo|condominium|village|project|residence|residences)\M', '', 'g'),
  '[^[:alnum:]]+',
  '',
  'g'
)
where normalized_name is null or normalized_name = '';

alter table property_projects alter column normalized_name set not null;

create index if not exists idx_property_projects_tenant_status
  on property_projects (tenant_id, status);
create index if not exists idx_property_projects_location
  on property_projects using gist (location);

create table if not exists properties (
  id uuid primary key,
  tenant_id text not null,
  project_id uuid,
  external_id text,
  title text not null,
  description text,
  kind text not null,
  listing_type text not null default 'sale',
  market text not null,
  status text not null,
  price_amount numeric(14, 2) not null,
  price_currency text not null,
  rental_price_monthly_amount numeric(14, 2),
  rental_price_monthly_currency text,
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

alter table properties add column if not exists listing_type text not null default 'sale';
alter table properties add column if not exists project_id uuid;
alter table properties add column if not exists external_id text;
alter table properties add column if not exists rental_price_monthly_amount numeric(14, 2);
alter table properties add column if not exists rental_price_monthly_currency text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'properties_project_id_fkey'
  ) then
    alter table properties
      add constraint properties_project_id_fkey
      foreign key (project_id) references property_projects(id) on delete set null;
  end if;
end $$;

with ranked_projects as (
  select
    id,
    first_value(id) over (
      partition by tenant_id, market, normalized_name
      order by updated_at desc, created_at desc, id
    ) as canonical_id
  from property_projects
)
update properties property
set project_id = ranked_projects.canonical_id
from ranked_projects
where property.project_id = ranked_projects.id
  and ranked_projects.id <> ranked_projects.canonical_id;

with ranked_projects as (
  select
    id,
    first_value(id) over (
      partition by tenant_id, market, normalized_name
      order by updated_at desc, created_at desc, id
    ) as canonical_id
  from property_projects
)
delete from property_projects project
using ranked_projects
where project.id = ranked_projects.id
  and ranked_projects.id <> ranked_projects.canonical_id;

create unique index if not exists idx_property_projects_tenant_market_name
  on property_projects (tenant_id, market, lower(name));
create unique index if not exists idx_property_projects_tenant_market_normalized_name
  on property_projects (tenant_id, market, normalized_name);
create unique index if not exists idx_properties_tenant_external_id on properties (tenant_id, external_id) where external_id is not null;
create index if not exists idx_properties_tenant_project on properties (tenant_id, project_id);
create index if not exists idx_properties_tenant_status on properties (tenant_id, status);
create index if not exists idx_properties_tenant_listing_type on properties (tenant_id, listing_type);
create index if not exists idx_properties_tenant_market on properties (tenant_id, market);
create index if not exists idx_properties_location on properties using gist (location);
create index if not exists idx_properties_price_amount on properties (price_amount);
create index if not exists idx_properties_rental_price_monthly_amount on properties (rental_price_monthly_amount);

create table if not exists saved_property_searches (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  user_id text,
  title text not null,
  natural_language_query text,
  locale text,
  purpose text,
  filters jsonb not null default '{}',
  match_count integer not null default 0,
  notifications_enabled boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_saved_property_searches_tenant_user
  on saved_property_searches (tenant_id, user_id, created_at desc);
create index if not exists idx_saved_property_searches_tenant_created
  on saved_property_searches (tenant_id, created_at desc);

create table if not exists saved_search_alert_runs (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  requested_by_user_id text,
  scope text not null,
  user_id text,
  dry_run boolean not null default true,
  status text not null,
  total_alerts integer not null default 0,
  total_candidates integer not null default 0,
  items jsonb not null default '[]',
  created_at timestamptz not null
);

create index if not exists idx_saved_search_alert_runs_tenant_created
  on saved_search_alert_runs (tenant_id, created_at desc);
create index if not exists idx_saved_search_alert_runs_tenant_user_created
  on saved_search_alert_runs (tenant_id, user_id, created_at desc);

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
  created_at timestamptz not null,
  deleted_at timestamptz
);

alter table property_images add column if not exists bucket text;
alter table property_images add column if not exists object_key text;
alter table property_images add column if not exists mime_type text;
alter table property_images add column if not exists size_bytes integer;
alter table property_images add column if not exists original_filename text;
alter table property_images add column if not exists deleted_at timestamptz;

create index if not exists idx_property_images_property on property_images (tenant_id, property_id, position, created_at);
create index if not exists idx_property_images_object_key on property_images (tenant_id, object_key);

create table if not exists property_image_delete_confirmations (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  image_id uuid not null,
  token_hash text not null unique,
  requested_by_user_id text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null
);

create index if not exists idx_property_image_delete_confirmations_lookup
  on property_image_delete_confirmations (tenant_id, property_id, image_id, expires_at)
  where consumed_at is null;

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

create table if not exists property_price_recommendation_feedback (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  engine text not null,
  model_version text not null,
  recommendation_generated_at timestamptz,
  suggested_price_amount numeric(14, 2) not null,
  suggested_price_currency text not null,
  decision text not null,
  selected_price_amount numeric(14, 2),
  selected_price_currency text,
  note text,
  created_by_user_id text,
  created_by_user_role text,
  created_at timestamptz not null
);

create index if not exists idx_price_recommendation_feedback_property on property_price_recommendation_feedback (tenant_id, property_id, created_at desc);
create index if not exists idx_price_recommendation_feedback_decision on property_price_recommendation_feedback (tenant_id, decision, created_at desc);
create index if not exists idx_price_recommendation_feedback_model on property_price_recommendation_feedback (tenant_id, engine, model_version);

create table if not exists property_social_post_publications (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  channel text not null,
  locale text not null,
  tracking_slug text not null,
  published_url text,
  utm jsonb not null,
  created_by_user_id text,
  created_by_user_role text,
  published_at timestamptz not null
);

create index if not exists idx_social_post_publications_property
  on property_social_post_publications (tenant_id, property_id, published_at desc);
create index if not exists idx_social_post_publications_channel
  on property_social_post_publications (tenant_id, channel, published_at desc);
create index if not exists idx_social_post_publications_tracking
  on property_social_post_publications (tenant_id, tracking_slug);

create table if not exists property_social_post_reviews (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  channel text not null,
  locale text not null,
  tracking_slug text not null,
  status text not null,
  note text,
  created_by_user_id text,
  created_by_user_role text,
  updated_by_user_id text,
  updated_by_user_role text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists idx_social_post_reviews_unique_draft
  on property_social_post_reviews (tenant_id, property_id, channel, locale, tracking_slug);
create index if not exists idx_social_post_reviews_property
  on property_social_post_reviews (tenant_id, property_id, updated_at desc);
create index if not exists idx_social_post_reviews_status
  on property_social_post_reviews (tenant_id, status, updated_at desc);

create table if not exists property_social_post_draft_overrides (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  channel text not null,
  locale text not null,
  tracking_slug text not null,
  hook text not null,
  body text not null,
  cta text not null,
  hashtags text[] not null default '{}',
  created_by_user_id text,
  created_by_user_role text,
  updated_by_user_id text,
  updated_by_user_role text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists idx_social_post_draft_overrides_unique_draft
  on property_social_post_draft_overrides (tenant_id, property_id, channel, locale, tracking_slug);
create index if not exists idx_social_post_draft_overrides_property
  on property_social_post_draft_overrides (tenant_id, property_id, updated_at desc);

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

create table if not exists security_event_acknowledgements (
  tenant_id text not null,
  event_id text not null,
  acknowledged_by_user_id text,
  acknowledged_by_user_role text,
  acknowledged_at timestamptz not null,
  note text,
  primary key (tenant_id, event_id)
);

create index if not exists idx_security_event_acknowledgements_tenant_acknowledged
  on security_event_acknowledgements (tenant_id, acknowledged_at desc);

create table if not exists concierge_sessions (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  user_id text,
  locale text not null,
  status text not null,
  profile jsonb not null default '{}',
  latest_response jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_concierge_sessions_tenant_updated on concierge_sessions (tenant_id, updated_at desc);
create index if not exists idx_concierge_sessions_tenant_user on concierge_sessions (tenant_id, user_id, updated_at desc);
create index if not exists idx_concierge_sessions_status on concierge_sessions (tenant_id, status, updated_at desc);

create table if not exists concierge_messages (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  session_id uuid not null references concierge_sessions(id) on delete cascade,
  role text not null,
  message text not null,
  response jsonb,
  profile jsonb,
  created_at timestamptz not null
);

create index if not exists idx_concierge_messages_session on concierge_messages (tenant_id, session_id, created_at);

create table if not exists concierge_feedback (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  session_id uuid not null references concierge_sessions(id) on delete cascade,
  rating text not null,
  area_accurate boolean,
  property_recommendations_useful boolean,
  selected_property_id uuid references properties(id) on delete set null,
  note text,
  created_by_user_id text,
  created_by_user_role text,
  created_at timestamptz not null
);

create index if not exists idx_concierge_feedback_session on concierge_feedback (tenant_id, session_id, created_at desc);
create index if not exists idx_concierge_feedback_rating on concierge_feedback (tenant_id, rating, created_at desc);

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

create table if not exists knowledge_document_chunks (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  document_id uuid not null references knowledge_documents(id) on delete cascade,
  chunk_index integer not null,
  title text not null,
  content text not null,
  locale text not null,
  kind text not null,
  tags text[] not null default '{}',
  token_estimate integer not null,
  search_text text not null,
  embedding_model text,
  embedding_status text not null default 'pending',
  embedding double precision[],
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (tenant_id, document_id, chunk_index)
);

create index if not exists idx_knowledge_document_chunks_document on knowledge_document_chunks (tenant_id, document_id);
create index if not exists idx_knowledge_document_chunks_locale_kind on knowledge_document_chunks (tenant_id, locale, kind);
create index if not exists idx_knowledge_document_chunks_search on knowledge_document_chunks using gin (to_tsvector('simple', search_text));
create index if not exists idx_knowledge_document_chunks_embedding_status on knowledge_document_chunks (tenant_id, embedding_status);

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

create table if not exists tenant_usage_events (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  event_type text not null,
  quantity integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null
);

create index if not exists idx_tenant_usage_events_tenant_type_created
  on tenant_usage_events (tenant_id, event_type, created_at desc);

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
  attribution_social_post_tracking_slug text,
  attribution_social_post_channel text,
  attribution_social_post_campaign text,
  priority text not null default 'medium',
  next_follow_up_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

alter table leads add column if not exists attribution_search_event_id uuid;
alter table leads add column if not exists attribution_search_query text;
alter table leads add column if not exists attribution_search_source text;
alter table leads add column if not exists attribution_social_post_tracking_slug text;
alter table leads add column if not exists attribution_social_post_channel text;
alter table leads add column if not exists attribution_social_post_campaign text;
alter table leads add column if not exists priority text not null default 'medium';
alter table leads add column if not exists next_follow_up_at timestamptz;

create index if not exists idx_leads_tenant_status on leads (tenant_id, status);
create index if not exists idx_leads_tenant_property on leads (tenant_id, property_id);
create index if not exists idx_leads_tenant_created on leads (tenant_id, created_at desc);
create index if not exists idx_leads_tenant_assigned_agent on leads (tenant_id, assigned_agent_id);
create index if not exists idx_leads_tenant_attribution_source on leads (tenant_id, attribution_search_source);
create index if not exists idx_leads_tenant_attribution_query on leads (tenant_id, attribution_search_query);
create index if not exists idx_leads_tenant_social_post_tracking on leads (tenant_id, attribution_social_post_tracking_slug);
create index if not exists idx_leads_tenant_social_post_channel on leads (tenant_id, attribution_social_post_channel);
create index if not exists idx_leads_tenant_follow_up on leads (tenant_id, next_follow_up_at, priority);

create table if not exists lead_status_events (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  previous_status text,
  status text not null,
  changed_by_user_id text,
  changed_by_user_role text,
  created_at timestamptz not null
);

create index if not exists idx_lead_status_events_lead
  on lead_status_events (tenant_id, lead_id, created_at);
create index if not exists idx_lead_status_events_status
  on lead_status_events (tenant_id, status, created_at desc);

create table if not exists lead_notes (
  id uuid primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  note text not null,
  created_by_user_id text,
  created_by_user_role text,
  created_at timestamptz not null
);

create index if not exists idx_lead_notes_lead
  on lead_notes (tenant_id, lead_id, created_at desc);
