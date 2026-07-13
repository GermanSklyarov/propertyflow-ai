import type { CreatePropertyRequest } from "@propertyflow/contracts";
import type { ThailandMarket } from "@propertyflow/domain";

const supportedMarkets = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"] as const;
const supportedKinds = ["condo", "villa", "townhouse", "land", "commercial"] as const;
const supportedListingTypes = ["sale", "rent", "sale_or_rent"] as const;

const marketCoordinates = {
  pattaya: { latitude: 12.9236, longitude: 100.8825 },
  phuket: { latitude: 7.8804, longitude: 98.3923 },
  bangkok: { latitude: 13.7563, longitude: 100.5018 },
  "hua-hin": { latitude: 12.5684, longitude: 99.9577 },
  "koh-samui": { latitude: 9.512, longitude: 100.0136 }
} satisfies Record<ThailandMarket, { latitude: number; longitude: number }>;

export interface ListingImportRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface ListingImportIssue {
  rowNumber: number;
  title?: string;
  reason: string;
}

export interface ListingImportParseResult {
  rows: ListingImportRow[];
  issues: ListingImportIssue[];
}

export function parseListingImportCsv(csv: string): ListingImportParseResult {
  const records = parseCsvRecords(csv).filter((record) => record.some((cell) => cell.trim().length > 0));

  if (records.length === 0) {
    return { rows: [], issues: [{ rowNumber: 0, reason: "CSV file is empty" }] };
  }

  const headers = records[0].map(normalizeHeader);
  const issues: ListingImportIssue[] = [];
  const rows: ListingImportRow[] = [];

  if (!headers.includes("title")) {
    issues.push({ rowNumber: 1, reason: "Missing required title column" });
  }

  for (const [index, record] of records.slice(1).entries()) {
    const values = Object.fromEntries(headers.map((header, headerIndex) => [header, record[headerIndex]?.trim() ?? ""]));
    const rowNumber = index + 2;

    if (!values.title) {
      issues.push({ rowNumber, reason: "Missing title" });
      continue;
    }

    rows.push({ rowNumber, values });
  }

  return { rows, issues };
}

export function buildCreatePropertyRequest(row: ListingImportRow): CreatePropertyRequest {
  const market = getEnumValue(row.values.market, supportedMarkets, "pattaya");
  const listingType = getEnumValue(row.values.listingtype ?? row.values.listing_type, supportedListingTypes, "sale_or_rent");
  const kind = getEnumValue(row.values.kind, supportedKinds, "condo");
  const priceThb = getNumber(row.values.pricethb ?? row.values.price_thb ?? row.values.price, 0);
  const rentalPriceMonthlyThb = getOptionalNumber(
    row.values.rentalpricemonthlythb ?? row.values.rental_price_monthly_thb ?? row.values.monthly_rent
  );
  const monthlyRentEstimateThb = getOptionalNumber(
    row.values.monthlyrentestimatethb ?? row.values.monthly_rent_estimate_thb ?? row.values.rentestimate
  );
  const maintenanceFeeMonthlyThb = getOptionalNumber(
    row.values.maintenancefeemonthlythb ?? row.values.maintenance_fee_monthly_thb ?? row.values.maintenance
  );

  return {
    title: row.values.title,
    description: row.values.description || undefined,
    kind,
    listingType,
    market,
    price: { amount: priceThb, currency: "THB" },
    ...(rentalPriceMonthlyThb !== undefined ? { rentalPriceMonthly: { amount: rentalPriceMonthlyThb, currency: "THB" } } : {}),
    location: marketCoordinates[market],
    address: row.values.address || undefined,
    bedrooms: getInteger(row.values.bedrooms, 0),
    bathrooms: getInteger(row.values.bathrooms, 0),
    areaSqm: getNumber(row.values.areasqm ?? row.values.area_sqm ?? row.values.area, 1),
    floor: getOptionalInteger(row.values.floor),
    beachDistanceMeters: getOptionalInteger(row.values.beachdistancemeters ?? row.values.beach_distance_meters),
    ...(monthlyRentEstimateThb !== undefined ? { monthlyRentEstimate: { amount: monthlyRentEstimateThb, currency: "THB" } } : {}),
    ...(maintenanceFeeMonthlyThb !== undefined ? { maintenanceFeeMonthly: { amount: maintenanceFeeMonthlyThb, currency: "THB" } } : {}),
    amenities: getAmenities(row.values.amenities)
  };
}

function parseCsvRecords(csv: string) {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRecord.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRecord.push(currentCell);
      records.push(currentRecord);
      currentRecord = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRecord.push(currentCell);
  records.push(currentRecord);

  return records;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function getEnumValue<const T extends readonly string[]>(value: string | undefined, values: T, fallback: T[number]): T[number] {
  return values.includes(value as T[number]) ? (value as T[number]) : fallback;
}

function getNumber(value: string | undefined, fallback: number) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function getOptionalNumber(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : undefined;
}

function getInteger(value: string | undefined, fallback: number) {
  return Math.trunc(getNumber(value, fallback));
}

function getOptionalInteger(value: string | undefined) {
  const numberValue = getOptionalNumber(value);

  return numberValue === undefined ? undefined : Math.trunc(numberValue);
}

function getAmenities(value: string | undefined) {
  return (value ?? "")
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
