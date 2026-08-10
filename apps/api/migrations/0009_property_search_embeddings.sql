do $$
begin
  if exists (
    select 1
    from pg_available_extensions
    where name = 'vector'
  ) then
    execute 'create extension if not exists vector';

    execute $ddl$
      create table if not exists property_search_embeddings (
        tenant_id text not null references tenants(id) on delete cascade,
        property_id uuid not null references properties(id) on delete cascade,
        search_text text not null,
        embedding vector,
        embedding_model text,
        embedding_status text not null default 'pending',
        last_error text,
        created_at timestamptz not null,
        updated_at timestamptz not null,
        constraint chk_property_search_embeddings_status
          check (embedding_status in ('pending', 'embedded', 'failed')),
        primary key (tenant_id, property_id)
      )
    $ddl$;

    execute $ddl$
      create index if not exists idx_property_search_embeddings_tenant_model
        on property_search_embeddings (tenant_id, embedding_model, embedding_status)
    $ddl$;
  else
    raise notice 'pgvector extension is not installed on this PostgreSQL host; skipping property_search_embeddings setup';
  end if;
end
$$;
