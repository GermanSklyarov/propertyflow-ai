create table if not exists listing_location_features (
  tenant_id text not null references tenants(id) on delete cascade,
  listing_id uuid not null references properties(id) on delete cascade,
  nearest_beach_distance_meters integer,
  nearest_baht_bus_route_distance_meters integer,
  nearest_public_transport_distance_meters integer,
  nearest_taxi_stand_distance_meters integer,
  nearest_supermarket_distance_meters integer,
  nearest_mall_distance_meters integer,
  nearest_hospital_distance_meters integer,
  nearest_international_school_distance_meters integer,
  nearest_nightlife_distance_meters integer,
  nearest_airport_connection_distance_meters integer,
  walkability_score integer,
  updated_at timestamptz not null,
  primary key (tenant_id, listing_id)
);

create index if not exists idx_listing_location_features_walkability
  on listing_location_features (tenant_id, walkability_score desc);
create index if not exists idx_listing_location_features_baht_bus
  on listing_location_features (tenant_id, nearest_baht_bus_route_distance_meters);
create index if not exists idx_listing_location_features_supermarket
  on listing_location_features (tenant_id, nearest_supermarket_distance_meters);
create index if not exists idx_listing_location_features_mall
  on listing_location_features (tenant_id, nearest_mall_distance_meters);
create index if not exists idx_listing_location_features_hospital
  on listing_location_features (tenant_id, nearest_hospital_distance_meters);
