alter table listing_source_configs
  add column if not exists sync_interval text not null default 'disabled',
  add column if not exists next_sync_at timestamptz;

create index if not exists idx_listing_source_configs_tenant_next_sync
  on listing_source_configs (tenant_id, next_sync_at)
  where sync_interval <> 'disabled';
