export function savedSearchFiltersMatchPropertySql(searchAlias: string, propertyAlias: string): string {
  return `
    (
      not ${searchAlias}.filters ? 'market'
      or ${propertyAlias}.market = ${searchAlias}.filters->>'market'
    )
    and (
      not ${searchAlias}.filters ? 'minPriceThb'
      or (${propertyAlias}.price_currency = 'THB' and ${propertyAlias}.price_amount >= (${searchAlias}.filters->>'minPriceThb')::numeric)
    )
    and (
      not ${searchAlias}.filters ? 'maxPriceThb'
      or (${propertyAlias}.price_currency = 'THB' and ${propertyAlias}.price_amount <= (${searchAlias}.filters->>'maxPriceThb')::numeric)
    )
    and (
      not ${searchAlias}.filters ? 'minBedrooms'
      or ${propertyAlias}.bedrooms >= (${searchAlias}.filters->>'minBedrooms')::integer
    )
    and (
      not ${searchAlias}.filters ? 'minBathrooms'
      or ${propertyAlias}.bathrooms >= (${searchAlias}.filters->>'minBathrooms')::integer
    )
    and (
      not ${searchAlias}.filters ? 'minAreaSqm'
      or ${propertyAlias}.area_sqm >= (${searchAlias}.filters->>'minAreaSqm')::numeric
    )
    and (
      not ${searchAlias}.filters ? 'maxBeachDistanceMeters'
      or ${propertyAlias}.beach_distance_meters <= (${searchAlias}.filters->>'maxBeachDistanceMeters')::integer
    )
    and (
      not ${searchAlias}.filters ? 'requiredAmenities'
      or ${propertyAlias}.amenities @> array(
        select jsonb_array_elements_text(${searchAlias}.filters->'requiredAmenities')
      )::text[]
    )
    and (
      not (${searchAlias}.filters ? 'near' and ${searchAlias}.filters ? 'radiusMeters')
      or st_dwithin(
        ${propertyAlias}.location,
        st_setsrid(
          st_makepoint(
            (${searchAlias}.filters->'near'->>'longitude')::double precision,
            (${searchAlias}.filters->'near'->>'latitude')::double precision
          ),
          4326
        )::geography,
        (${searchAlias}.filters->>'radiusMeters')::double precision
      )
    )
  `;
}
