alter table tenants
  add column if not exists widget_listing_url_template text not null default '/listings/:propertyId';
