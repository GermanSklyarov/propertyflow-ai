import { Pool } from "pg";
import { loadAppConfig } from "@propertyflow/config";
import type {
  Currency,
  PropertyKind,
  PropertyListingType,
  PropertyProjectStatus,
  PropertyStatus,
  ThailandMarket
} from "@propertyflow/domain";

type SeedMoney = {
  amount: number;
  currency: Currency;
};

type SeedProperty = {
  id: string;
  projectId?: string;
  title: string;
  description: string;
  kind: PropertyKind;
  listingType: PropertyListingType;
  market: ThailandMarket;
  status: PropertyStatus;
  price: SeedMoney;
  rentalPriceMonthly?: SeedMoney;
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  floor?: number;
  beachDistanceMeters?: number;
  monthlyRentEstimate?: SeedMoney;
  maintenanceFeeMonthly?: SeedMoney;
  amenities: string[];
};

type SeedProject = {
  id: string;
  name: string;
  normalizedName: string;
  market: ThailandMarket;
  status: PropertyProjectStatus;
  developer?: string;
  address: string;
  completionYear?: number;
  location: {
    latitude: number;
    longitude: number;
  };
  amenities: string[];
};

const tenantId = process.env.SEED_TENANT_ID ?? "demo-agency";
const now = new Date().toISOString();

const demoProjects: SeedProject[] = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    name: "The Riviera Wongamat",
    normalizedName: "rivierawongamat",
    market: "pattaya",
    status: "completed",
    developer: "Riviera Group",
    address: "Wongamat Beach, Pattaya",
    completionYear: 2017,
    location: { latitude: 12.9642, longitude: 100.8903 },
    amenities: ["sea-view", "pool", "gym", "fiber-internet", "parking"]
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    name: "Copacabana Jomtien",
    normalizedName: "copacabanajomtien",
    market: "pattaya",
    status: "completed",
    developer: "Copacabana Group",
    address: "Jomtien Second Road, Pattaya",
    completionYear: 2022,
    location: { latitude: 12.8898, longitude: 100.8759 },
    amenities: ["pool", "kids-room", "parking", "balcony", "beach-access"]
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    name: "Grand Solaire Noble",
    normalizedName: "grandsolairenoble",
    market: "pattaya",
    status: "under_construction",
    developer: "SLS Development",
    address: "Thappraya Road, Pattaya",
    completionYear: 2026,
    location: { latitude: 12.9187, longitude: 100.8654 },
    amenities: ["pool", "gym", "sky-lounge", "security"]
  },
  {
    id: "30000000-0000-4000-8000-000000000004",
    name: "Laguna Phuket",
    normalizedName: "lagunaphuket",
    market: "phuket",
    status: "completed",
    developer: "Laguna Property",
    address: "Bang Tao, Phuket",
    completionYear: 2021,
    location: { latitude: 7.9907, longitude: 98.2931 },
    amenities: ["pool", "rental-management", "beach-club-access", "gym", "security"]
  }
];

const demoProperties: SeedProperty[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    projectId: "30000000-0000-4000-8000-000000000001",
    title: "Wongamat Sea View Residence",
    description:
      "High-floor condo near Wongamat beach with sea view, fiber internet, pool, gym, and strong winter rental appeal.",
    kind: "condo",
    listingType: "sale_or_rent",
    market: "pattaya",
    status: "available",
    price: { amount: 3_450_000, currency: "THB" },
    rentalPriceMonthly: { amount: 28_000, currency: "THB" },
    location: { latitude: 12.9642, longitude: 100.8903 },
    address: "Wongamat Beach, Pattaya",
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 42,
    floor: 18,
    beachDistanceMeters: 220,
    monthlyRentEstimate: { amount: 24_000, currency: "THB" },
    maintenanceFeeMonthly: { amount: 2_100, currency: "THB" },
    amenities: ["sea-view", "pool", "gym", "fiber-internet", "parking"]
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    title: "Terminal 21 Walkable Studio",
    description:
      "Compact rental studio close to Terminal 21, cafes, baht bus routes, and daily conveniences for remote workers.",
    kind: "condo",
    listingType: "rent",
    market: "pattaya",
    status: "available",
    price: { amount: 2_100_000, currency: "THB" },
    rentalPriceMonthly: { amount: 19_000, currency: "THB" },
    location: { latitude: 12.9477, longitude: 100.8891 },
    address: "Terminal 21 Pattaya area",
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 31,
    floor: 9,
    beachDistanceMeters: 650,
    monthlyRentEstimate: { amount: 18_000, currency: "THB" },
    maintenanceFeeMonthly: { amount: 1_350, currency: "THB" },
    amenities: ["fiber-internet", "pool", "coworking-lounge", "security"]
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    projectId: "30000000-0000-4000-8000-000000000002",
    title: "Jomtien Family Corner Condo",
    description:
      "Quiet two-bedroom corner unit near Jomtien beach, international schools, supermarkets, and family-friendly restaurants.",
    kind: "condo",
    listingType: "sale",
    market: "pattaya",
    status: "available",
    price: { amount: 4_850_000, currency: "THB" },
    location: { latitude: 12.8898, longitude: 100.8759 },
    address: "Jomtien Second Road, Pattaya",
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 72,
    floor: 11,
    beachDistanceMeters: 520,
    monthlyRentEstimate: { amount: 31_000, currency: "THB" },
    maintenanceFeeMonthly: { amount: 3_600, currency: "THB" },
    amenities: ["pool", "kids-room", "parking", "balcony", "quiet-zone"]
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    projectId: "30000000-0000-4000-8000-000000000003",
    title: "Pratumnak Investment One-Bed",
    description:
      "Investor-friendly one-bedroom between Pattaya and Jomtien with proven short-stay demand and low monthly ownership costs.",
    kind: "condo",
    listingType: "sale",
    market: "pattaya",
    status: "available",
    price: { amount: 2_950_000, currency: "THB" },
    location: { latitude: 12.9187, longitude: 100.8654 },
    address: "Pratumnak Hill, Pattaya",
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 38,
    floor: 7,
    beachDistanceMeters: 780,
    monthlyRentEstimate: { amount: 20_500, currency: "THB" },
    maintenanceFeeMonthly: { amount: 1_650, currency: "THB" },
    amenities: ["pool", "gym", "sauna", "security"]
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    title: "Na Jomtien Beachfront Lease",
    description:
      "Spacious beachfront rental with a calmer resort feel, large balcony, direct beach access, and room for longer family stays.",
    kind: "condo",
    listingType: "rent",
    market: "pattaya",
    status: "available",
    price: { amount: 7_800_000, currency: "THB" },
    rentalPriceMonthly: { amount: 52_000, currency: "THB" },
    location: { latitude: 12.8402, longitude: 100.9057 },
    address: "Na Jomtien beachfront",
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 86,
    floor: 15,
    beachDistanceMeters: 60,
    monthlyRentEstimate: { amount: 50_000, currency: "THB" },
    maintenanceFeeMonthly: { amount: 4_700, currency: "THB" },
    amenities: ["beachfront", "sea-view", "pool", "parking", "family-ready"]
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    title: "Central Pattaya Rental Loft",
    description:
      "City-center loft for tenants who want nightlife, shopping, restaurants, and quick access to beach road without a car.",
    kind: "condo",
    listingType: "rent",
    market: "pattaya",
    status: "available",
    price: { amount: 3_200_000, currency: "THB" },
    rentalPriceMonthly: { amount: 24_000, currency: "THB" },
    location: { latitude: 12.9349, longitude: 100.8837 },
    address: "Central Pattaya, near Beach Road",
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 45,
    floor: 12,
    beachDistanceMeters: 430,
    monthlyRentEstimate: { amount: 23_000, currency: "THB" },
    maintenanceFeeMonthly: { amount: 2_250, currency: "THB" },
    amenities: ["pool", "gym", "nightlife-access", "shopping", "fiber-internet"]
  },
  {
    id: "10000000-0000-4000-8000-000000000007",
    title: "Bangkok Ekkamai Remote Work Condo",
    description:
      "BTS-accessible Bangkok condo with work desk area, fast internet, quiet bedroom, and strong long-term rental demand.",
    kind: "condo",
    listingType: "sale_or_rent",
    market: "bangkok",
    status: "available",
    price: { amount: 6_900_000, currency: "THB" },
    rentalPriceMonthly: { amount: 38_000, currency: "THB" },
    location: { latitude: 13.7198, longitude: 100.5854 },
    address: "Ekkamai, Bangkok",
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 47,
    floor: 21,
    monthlyRentEstimate: { amount: 36_000, currency: "THB" },
    maintenanceFeeMonthly: { amount: 3_300, currency: "THB" },
    amenities: ["bts-access", "fiber-internet", "coworking-lounge", "gym", "pool"]
  },
  {
    id: "10000000-0000-4000-8000-000000000008",
    title: "Phuket Rawai Pool Villa",
    description:
      "Private villa in Rawai for relocation or family living with pool, parking, outdoor dining, and easy access to beaches.",
    kind: "villa",
    listingType: "sale",
    market: "phuket",
    status: "available",
    price: { amount: 12_900_000, currency: "THB" },
    location: { latitude: 7.7797, longitude: 98.3253 },
    address: "Rawai, Phuket",
    bedrooms: 3,
    bathrooms: 3,
    areaSqm: 210,
    beachDistanceMeters: 1_600,
    monthlyRentEstimate: { amount: 86_000, currency: "THB" },
    maintenanceFeeMonthly: { amount: 7_500, currency: "THB" },
    amenities: ["private-pool", "parking", "garden", "family-ready", "pet-friendly"]
  },
  {
    id: "10000000-0000-4000-8000-000000000009",
    projectId: "30000000-0000-4000-8000-000000000004",
    title: "Phuket Bang Tao Holiday Apartment",
    description:
      "Resort-style apartment near Bang Tao with beach clubs, restaurants, rental management, and strong seasonal occupancy.",
    kind: "condo",
    listingType: "sale_or_rent",
    market: "phuket",
    status: "available",
    price: { amount: 5_600_000, currency: "THB" },
    rentalPriceMonthly: { amount: 45_000, currency: "THB" },
    location: { latitude: 7.9907, longitude: 98.2931 },
    address: "Bang Tao, Phuket",
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 52,
    floor: 5,
    beachDistanceMeters: 700,
    monthlyRentEstimate: { amount: 42_000, currency: "THB" },
    maintenanceFeeMonthly: { amount: 3_900, currency: "THB" },
    amenities: ["pool", "rental-management", "beach-club-access", "gym", "security"]
  },
  {
    id: "10000000-0000-4000-8000-000000000010",
    title: "Hua Hin Golf Residence",
    description:
      "Relaxed two-bedroom home near golf courses, hospitals, cafes, and beaches for quiet long-stay living.",
    kind: "townhouse",
    listingType: "sale",
    market: "hua-hin",
    status: "available",
    price: { amount: 4_250_000, currency: "THB" },
    location: { latitude: 12.5684, longitude: 99.9577 },
    address: "Hua Hin west side",
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 118,
    beachDistanceMeters: 2_400,
    monthlyRentEstimate: { amount: 27_000, currency: "THB" },
    maintenanceFeeMonthly: { amount: 2_200, currency: "THB" },
    amenities: ["parking", "garden", "quiet-zone", "golf-access", "hospital-nearby"]
  },
  {
    id: "10000000-0000-4000-8000-000000000011",
    title: "Koh Samui Sea View Villa",
    description:
      "Hillside villa with panoramic sea views, private pool, rental management option, and premium holiday positioning.",
    kind: "villa",
    listingType: "sale_or_rent",
    market: "koh-samui",
    status: "available",
    price: { amount: 18_500_000, currency: "THB" },
    rentalPriceMonthly: { amount: 145_000, currency: "THB" },
    location: { latitude: 9.5361, longitude: 100.0612 },
    address: "Chaweng Noi, Koh Samui",
    bedrooms: 4,
    bathrooms: 4,
    areaSqm: 320,
    beachDistanceMeters: 1_100,
    monthlyRentEstimate: { amount: 132_000, currency: "THB" },
    maintenanceFeeMonthly: { amount: 12_500, currency: "THB" },
    amenities: ["sea-view", "private-pool", "rental-management", "parking", "staff-room"]
  },
  {
    id: "10000000-0000-4000-8000-000000000012",
    title: "Bangkok Sathorn Family Duplex",
    description:
      "Large city duplex near international schools, hospitals, offices, and MRT for families relocating to Bangkok.",
    kind: "condo",
    listingType: "rent",
    market: "bangkok",
    status: "available",
    price: { amount: 14_200_000, currency: "THB" },
    rentalPriceMonthly: { amount: 82_000, currency: "THB" },
    location: { latitude: 13.7214, longitude: 100.5296 },
    address: "Sathorn, Bangkok",
    bedrooms: 3,
    bathrooms: 3,
    areaSqm: 142,
    floor: 28,
    monthlyRentEstimate: { amount: 78_000, currency: "THB" },
    maintenanceFeeMonthly: { amount: 8_900, currency: "THB" },
    amenities: ["mrt-access", "school-nearby", "hospital-nearby", "pool", "gym", "parking"]
  }
];

const config = loadAppConfig();
const pool = new Pool({
  connectionString: config.databaseUrl
});

try {
  await ensureTenantExists();

  for (const project of demoProjects) {
    await upsertProject(project);
  }

  for (const property of demoProperties) {
    await upsertProperty(property);
    await upsertInitialPriceHistory(property);
  }

  console.log(`Seeded ${demoProperties.length} demo properties and ${demoProjects.length} demo projects for tenant "${tenantId}".`);
} finally {
  await pool.end();
}

async function ensureTenantExists() {
  const result = await pool.query("select id from tenants where id = $1 limit 1", [tenantId]);

  if (!result.rows[0]) {
    throw new Error(`Tenant "${tenantId}" does not exist. Run migrations before seeding demo properties.`);
  }
}

async function upsertProject(project: SeedProject) {
  await pool.query(
    `
      insert into property_projects (
        id,
        tenant_id,
        name,
        normalized_name,
        market,
        status,
        developer,
        address,
        completion_year,
        location,
        latitude,
        longitude,
        amenities,
        created_at,
        updated_at
      ) values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        st_setsrid(st_makepoint($10, $11), 4326)::geography,
        $11,
        $10,
        $12,
        $13,
        $14
      )
      on conflict (tenant_id, market, normalized_name) do update set
        name = excluded.name,
        status = excluded.status,
        developer = excluded.developer,
        address = excluded.address,
        completion_year = excluded.completion_year,
        location = excluded.location,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        amenities = excluded.amenities,
        updated_at = excluded.updated_at
    `,
    [
      project.id,
      tenantId,
      project.name,
      project.normalizedName,
      project.market,
      project.status,
      project.developer ?? null,
      project.address,
      project.completionYear ?? null,
      project.location.longitude,
      project.location.latitude,
      project.amenities,
      now,
      now
    ]
  );
}

async function upsertProperty(property: SeedProperty) {
  await pool.query(
    `
      insert into properties (
        id,
        tenant_id,
        title,
        description,
        kind,
        listing_type,
        market,
        status,
        price_amount,
        price_currency,
        rental_price_monthly_amount,
        rental_price_monthly_currency,
        location,
        latitude,
        longitude,
        address,
        bedrooms,
        bathrooms,
        area_sqm,
        floor,
        beach_distance_meters,
        monthly_rent_estimate_amount,
        monthly_rent_estimate_currency,
        maintenance_fee_monthly_amount,
        maintenance_fee_monthly_currency,
        amenities,
        created_at,
        updated_at
      ) values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        st_setsrid(st_makepoint($13, $14), 4326)::geography,
        $14,
        $13,
        $15,
        $16,
        $17,
        $18,
        $19,
        $20,
        $21,
        $22,
        $23,
        $24,
        $25,
        $26,
        $27
      )
      on conflict (id) do update set
        tenant_id = excluded.tenant_id,
        title = excluded.title,
        description = excluded.description,
        kind = excluded.kind,
        listing_type = excluded.listing_type,
        market = excluded.market,
        status = excluded.status,
        price_amount = excluded.price_amount,
        price_currency = excluded.price_currency,
        rental_price_monthly_amount = excluded.rental_price_monthly_amount,
        rental_price_monthly_currency = excluded.rental_price_monthly_currency,
        location = excluded.location,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        address = excluded.address,
        bedrooms = excluded.bedrooms,
        bathrooms = excluded.bathrooms,
        area_sqm = excluded.area_sqm,
        floor = excluded.floor,
        beach_distance_meters = excluded.beach_distance_meters,
        monthly_rent_estimate_amount = excluded.monthly_rent_estimate_amount,
        monthly_rent_estimate_currency = excluded.monthly_rent_estimate_currency,
        maintenance_fee_monthly_amount = excluded.maintenance_fee_monthly_amount,
        maintenance_fee_monthly_currency = excluded.maintenance_fee_monthly_currency,
        amenities = excluded.amenities,
        updated_at = excluded.updated_at
    `,
    [
      property.id,
      tenantId,
      property.title,
      property.description,
      property.kind,
      property.listingType,
      property.market,
      property.status,
      property.price.amount,
      property.price.currency,
      property.rentalPriceMonthly?.amount ?? null,
      property.rentalPriceMonthly?.currency ?? null,
      property.location.longitude,
      property.location.latitude,
      property.address,
      property.bedrooms,
      property.bathrooms,
      property.areaSqm,
      property.floor ?? null,
      property.beachDistanceMeters ?? null,
      property.monthlyRentEstimate?.amount ?? null,
      property.monthlyRentEstimate?.currency ?? null,
      property.maintenanceFeeMonthly?.amount ?? null,
      property.maintenanceFeeMonthly?.currency ?? null,
      property.amenities,
      now,
      now
    ]
  );

  await pool.query("update properties set project_id = $1, updated_at = $2 where tenant_id = $3 and id = $4", [
    property.projectId ?? null,
    now,
    tenantId,
    property.id
  ]);
}

async function upsertInitialPriceHistory(property: SeedProperty) {
  await pool.query(
    `
      insert into property_price_history (
        id,
        tenant_id,
        property_id,
        price_amount,
        price_currency,
        source,
        effective_date
      ) values (
        $1,
        $2,
        $3,
        $4,
        $5,
        'initial-listing',
        $6
      )
      on conflict (id) do update set
        tenant_id = excluded.tenant_id,
        property_id = excluded.property_id,
        price_amount = excluded.price_amount,
        price_currency = excluded.price_currency,
        source = excluded.source,
        effective_date = excluded.effective_date
    `,
    [toInitialHistoryId(property.id), tenantId, property.id, property.price.amount, property.price.currency, now]
  );
}

function toInitialHistoryId(propertyId: string) {
  return propertyId.replace("10000000-0000-4000-8000", "20000000-0000-4000-8000");
}
