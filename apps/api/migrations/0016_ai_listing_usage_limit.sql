update tenants
set limits = jsonb_set(
  limits,
  '{aiListings}',
  coalesce(limits -> 'aiListings', limits -> 'properties', '1000'::jsonb),
  true
)
where not (limits ? 'aiListings');
