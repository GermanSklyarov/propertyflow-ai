alter table tenants
  add column if not exists widget_lead_notifications_enabled boolean not null default true,
  add column if not exists widget_lead_notification_emails text[] not null default array[]::text[],
  add column if not exists widget_lead_webhook_url text,
  add column if not exists widget_lead_telegram_chat_ids text[] not null default array[]::text[],
  add column if not exists widget_lead_line_recipient_ids text[] not null default array[]::text[],
  add column if not exists widget_lead_whatsapp_recipients text[] not null default array[]::text[];
