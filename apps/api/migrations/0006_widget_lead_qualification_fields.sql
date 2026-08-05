alter table tenants
  add column if not exists widget_lead_qualification_fields text[] not null
  default array['budget','preferredArea','bedrooms','investmentPurpose','moveInDate','financing','whatsapp','email','phone'];
