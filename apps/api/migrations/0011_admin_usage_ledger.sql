alter table tenant_usage_events add column if not exists service text;
alter table tenant_usage_events add column if not exists operation text;
alter table tenant_usage_events add column if not exists unit text;
alter table tenant_usage_events add column if not exists estimated_cost_usd numeric(12, 6) not null default 0;

update tenant_usage_events
set
  service = coalesce(service, split_part(event_type, '.', 1)),
  operation = coalesce(operation, event_type),
  unit = coalesce(unit, 'event')
where service is null
  or operation is null
  or unit is null;

alter table tenant_usage_events alter column service set not null;
alter table tenant_usage_events alter column operation set not null;
alter table tenant_usage_events alter column unit set not null;

create index if not exists idx_tenant_usage_events_service_operation_created
  on tenant_usage_events (service, operation, created_at desc);

create index if not exists idx_tenant_usage_events_tenant_service_created
  on tenant_usage_events (tenant_id, service, created_at desc);
