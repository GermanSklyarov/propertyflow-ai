alter table tenants
  add column if not exists widget_lead_telegram_chat_ids text[] not null default array[]::text[],
  add column if not exists widget_lead_telegram_bot_token text,
  add column if not exists widget_lead_line_recipient_ids text[] not null default array[]::text[],
  add column if not exists widget_lead_line_channel_access_token text,
  add column if not exists widget_lead_whatsapp_recipients text[] not null default array[]::text[],
  add column if not exists widget_lead_whatsapp_access_token text,
  add column if not exists widget_lead_whatsapp_phone_number_id text,
  add column if not exists widget_lead_whatsapp_graph_api_version text not null default 'v20.0';
