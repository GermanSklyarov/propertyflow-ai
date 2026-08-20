create table if not exists public_widget_conversation_handoffs (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  tenant_slug text not null,
  provider text not null check (provider in ('telegram', 'line', 'whatsapp')),
  token_hash text not null unique,
  session_id text,
  locale text not null check (locale in ('en', 'ru', 'th', 'zh')),
  conversation jsonb not null default '[]'::jsonb,
  recipient_id text,
  status text not null default 'pending' check (status in ('pending', 'linked', 'expired')),
  expires_at timestamptz not null,
  linked_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_public_widget_handoffs_token_hash
  on public_widget_conversation_handoffs (token_hash);

create index if not exists idx_public_widget_handoffs_recipient
  on public_widget_conversation_handoffs (tenant_id, provider, recipient_id, updated_at desc);

create index if not exists idx_public_widget_handoffs_expiry
  on public_widget_conversation_handoffs (expires_at);
