import type { Pool } from "pg";
import type { GeoPoint, ThailandMarket } from "@propertyflow/domain";

interface PropertyLocationRow {
  id: string;
  market: ThailandMarket;
  latitude: number;
  longitude: number;
  beach_distance_meters: number | null;
}

type FeatureCategory =
  | "airportConnection"
  | "bahtBusRoute"
  | "beach"
  | "hospital"
  | "internationalSchool"
  | "mall"
  | "nightlife"
  | "publicTransport"
  | "supermarket"
  | "taxiStand";

interface LocationFeaturePoi {
  category: FeatureCategory;
  label: string;
  location: GeoPoint;
  market: ThailandMarket;
}

const LOCATION_FEATURE_POIS: LocationFeaturePoi[] = [
  { category: "beach", label: "Pattaya Beach", location: { latitude: 12.9366, longitude: 100.8834 }, market: "pattaya" },
  { category: "beach", label: "Jomtien Beach", location: { latitude: 12.8906, longitude: 100.8697 }, market: "pattaya" },
  { category: "bahtBusRoute", label: "Second Road baht bus route", location: { latitude: 12.9369, longitude: 100.8849 }, market: "pattaya" },
  { category: "bahtBusRoute", label: "Jomtien Beach Road baht bus route", location: { latitude: 12.8944, longitude: 100.8699 }, market: "pattaya" },
  { category: "publicTransport", label: "North Pattaya bus terminal", location: { latitude: 12.9533, longitude: 100.9031 }, market: "pattaya" },
  { category: "taxiStand", label: "Terminal 21 taxi stand", location: { latitude: 12.9497, longitude: 100.889 }, market: "pattaya" },
  { category: "supermarket", label: "Big C Extra Pattaya", location: { latitude: 12.9394, longitude: 100.896 }, market: "pattaya" },
  { category: "supermarket", label: "Lotus's South Pattaya", location: { latitude: 12.9147, longitude: 100.8962 }, market: "pattaya" },
  { category: "mall", label: "Terminal 21 Pattaya", location: { latitude: 12.9497, longitude: 100.889 }, market: "pattaya" },
  { category: "mall", label: "Central Pattaya", location: { latitude: 12.9348, longitude: 100.8832 }, market: "pattaya" },
  { category: "hospital", label: "Bangkok Hospital Pattaya", location: { latitude: 12.9495, longitude: 100.9088 }, market: "pattaya" },
  { category: "internationalSchool", label: "Regents International School Pattaya", location: { latitude: 12.9675, longitude: 100.9908 }, market: "pattaya" },
  { category: "nightlife", label: "Walking Street", location: { latitude: 12.9279, longitude: 100.8738 }, market: "pattaya" },
  { category: "airportConnection", label: "U-Tapao airport connection", location: { latitude: 12.6809, longitude: 101.005 }, market: "pattaya" },
  { category: "beach", label: "Patong Beach", location: { latitude: 7.8965, longitude: 98.2966 }, market: "phuket" },
  { category: "mall", label: "Central Phuket", location: { latitude: 7.8917, longitude: 98.3686 }, market: "phuket" },
  { category: "hospital", label: "Bangkok Hospital Phuket", location: { latitude: 7.9078, longitude: 98.3783 }, market: "phuket" },
  { category: "airportConnection", label: "Phuket International Airport", location: { latitude: 8.1132, longitude: 98.3169 }, market: "phuket" },
  { category: "publicTransport", label: "BTS Asok", location: { latitude: 13.737, longitude: 100.5604 }, market: "bangkok" },
  { category: "mall", label: "Terminal 21 Bangkok", location: { latitude: 13.7377, longitude: 100.5602 }, market: "bangkok" },
  { category: "hospital", label: "Bumrungrad International Hospital", location: { latitude: 13.746, longitude: 100.552 }, market: "bangkok" },
  { category: "beach", label: "Hua Hin Beach", location: { latitude: 12.5684, longitude: 99.9577 }, market: "hua-hin" },
  { category: "mall", label: "Bluport Hua Hin", location: { latitude: 12.5488, longitude: 99.9622 }, market: "hua-hin" },
  { category: "beach", label: "Chaweng Beach", location: { latitude: 9.5275, longitude: 100.0644 }, market: "koh-samui" },
  { category: "mall", label: "Central Samui", location: { latitude: 9.5315, longitude: 100.0617 }, market: "koh-samui" }
];

export class PropertyLocationEnricher {
  constructor(private readonly pool: Pool) {}

  async enrichProperty(tenantId: string, propertyId: string): Promise<{ propertyId: string; walkabilityScore: number }> {
    const result = await this.pool.query<PropertyLocationRow>(
      `
        select id, market, latitude, longitude, beach_distance_meters
        from properties
        where tenant_id = $1 and id = $2
        limit 1
      `,
      [tenantId, propertyId]
    );
    const property = result.rows[0];

    if (!property) {
      throw new Error(`Property ${propertyId} was not found for tenant ${tenantId}`);
    }

    const location = { latitude: Number(property.latitude), longitude: Number(property.longitude) };
    const distances = nearestDistances(property.market, location);
    const nearestBeachDistanceMeters = property.beach_distance_meters ?? distances.beach;
    const walkabilityScore = calculateWalkabilityScore({
      ...distances,
      beach: nearestBeachDistanceMeters
    });
    const now = new Date().toISOString();

    await this.pool.query(
      `
        insert into listing_location_features (
          tenant_id,
          listing_id,
          nearest_beach_distance_meters,
          nearest_baht_bus_route_distance_meters,
          nearest_public_transport_distance_meters,
          nearest_taxi_stand_distance_meters,
          nearest_supermarket_distance_meters,
          nearest_mall_distance_meters,
          nearest_hospital_distance_meters,
          nearest_international_school_distance_meters,
          nearest_nightlife_distance_meters,
          nearest_airport_connection_distance_meters,
          walkability_score,
          updated_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
        on conflict (tenant_id, listing_id) do update set
          nearest_beach_distance_meters = excluded.nearest_beach_distance_meters,
          nearest_baht_bus_route_distance_meters = excluded.nearest_baht_bus_route_distance_meters,
          nearest_public_transport_distance_meters = excluded.nearest_public_transport_distance_meters,
          nearest_taxi_stand_distance_meters = excluded.nearest_taxi_stand_distance_meters,
          nearest_supermarket_distance_meters = excluded.nearest_supermarket_distance_meters,
          nearest_mall_distance_meters = excluded.nearest_mall_distance_meters,
          nearest_hospital_distance_meters = excluded.nearest_hospital_distance_meters,
          nearest_international_school_distance_meters = excluded.nearest_international_school_distance_meters,
          nearest_nightlife_distance_meters = excluded.nearest_nightlife_distance_meters,
          nearest_airport_connection_distance_meters = excluded.nearest_airport_connection_distance_meters,
          walkability_score = excluded.walkability_score,
          updated_at = excluded.updated_at
      `,
      [
        tenantId,
        propertyId,
        nearestBeachDistanceMeters,
        distances.bahtBusRoute,
        distances.publicTransport,
        distances.taxiStand,
        distances.supermarket,
        distances.mall,
        distances.hospital,
        distances.internationalSchool,
        distances.nightlife,
        distances.airportConnection,
        walkabilityScore,
        now
      ]
    );

    return { propertyId, walkabilityScore };
  }
}

function nearestDistances(market: ThailandMarket, location: GeoPoint): Partial<Record<FeatureCategory, number>> {
  return LOCATION_FEATURE_POIS.filter((poi) => poi.market === market).reduce<Partial<Record<FeatureCategory, number>>>((distances, poi) => {
    const distance = Math.round(distanceMeters(location, poi.location));
    const existing = distances[poi.category];
    distances[poi.category] = existing === undefined ? distance : Math.min(existing, distance);
    return distances;
  }, {});
}

function calculateWalkabilityScore(distances: Partial<Record<FeatureCategory, number>>): number {
  const supermarket = proximityScore(distances.supermarket, 1200);
  const transit = Math.max(proximityScore(distances.bahtBusRoute, 800), proximityScore(distances.publicTransport, 900));
  const mall = proximityScore(distances.mall, 3000);
  const beach = proximityScore(distances.beach, 1500);
  const taxi = proximityScore(distances.taxiStand, 1000);

  return Math.round(supermarket * 35 + transit * 30 + mall * 15 + beach * 10 + taxi * 10);
}

function proximityScore(distanceMeters: number | undefined, comfortableDistanceMeters: number): number {
  if (distanceMeters === undefined) {
    return 0;
  }

  return Math.max(0, Math.min(1, 1 - distanceMeters / comfortableDistanceMeters));
}

function distanceMeters(from: GeoPoint, to: GeoPoint): number {
  const earthRadiusMeters = 6_371_000;
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
