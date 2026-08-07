create table if not exists notification_connection_tokens (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  provider text not null check (provider in ('telegram', 'line', 'whatsapp')),
  code text not null unique,
  recipient_id text,
  recipient_label text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null
);

create index if not exists idx_notification_connection_tokens_code
  on notification_connection_tokens (code);

create index if not exists idx_notification_connection_tokens_tenant_provider
  on notification_connection_tokens (tenant_id, provider, created_at desc);
