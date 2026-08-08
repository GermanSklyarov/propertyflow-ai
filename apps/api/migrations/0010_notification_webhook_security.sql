alter table tenants
  add column if not exists widget_lead_telegram_webhook_secret text,
  add column if not exists widget_lead_whatsapp_app_secret text,
  add column if not exists widget_lead_whatsapp_webhook_verify_token text;
