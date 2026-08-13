import { Injectable, Logger } from "@nestjs/common";
import type { GeoPoint, PropertySnapshot, ThailandMarket } from "@propertyflow/domain";

export type LocationComparisonTarget =
  | {
      kind: "poi";
      poi: CityPoi;
    }
  | {
      category: CityPoiCategory;
      kind: "category";
      label: string;
      pois: CityPoi[];
    };

export interface CityPoi {
  aliases: string[];
  category: CityPoiCategory;
  id: string;
  label: string;
  location: GeoPoint;
  market: ThailandMarket;
}

export type CityPoiCategory =
  | "airport"
  | "beach"
  | "hospital"
  | "landmark"
  | "mall"
  | "nightlife"
  | "park"
  | "pier"
  | "school"
  | "supermarket"
  | "transport";

export interface PropertyLocationDistance {
  distanceMeters: number;
  property: PropertySnapshot;
  targetLabel: string;
}

const CITY_POIS: CityPoi[] = [
  {
    aliases: ["walking street", "pattaya walking street", "уокинг стрит", "волкинг стрит", "walkingstreet", "步行街"],
    category: "nightlife",
    id: "pattaya-walking-street",
    label: "Walking Street",
    location: { latitude: 12.9279, longitude: 100.8738 },
    market: "pattaya"
  },
  {
    aliases: ["bali hai pier", "bali hai", "балихай", "пир балихай", "ท่าเรือบาลีฮาย", "巴厘海码头"],
    category: "pier",
    id: "pattaya-bali-hai-pier",
    label: "Bali Hai Pier",
    location: { latitude: 12.9238, longitude: 100.8666 },
    market: "pattaya"
  },
  {
    aliases: ["central festival", "central pattaya", "central pattaya mall", "централ фестиваль", "เซ็นทรัลพัทยา", "尚泰芭提雅"],
    category: "mall",
    id: "pattaya-central-festival",
    label: "Central Pattaya",
    location: { latitude: 12.9348, longitude: 100.8832 },
    market: "pattaya"
  },
  {
    aliases: ["terminal 21", "terminal 21 pattaya", "терминал 21", "เทอร์มินอล 21", "航站楼21"],
    category: "mall",
    id: "pattaya-terminal-21",
    label: "Terminal 21 Pattaya",
    location: { latitude: 12.9497, longitude: 100.889 },
    market: "pattaya"
  },
  {
    aliases: ["bangkok hospital pattaya", "bph", "бангкок госпиталь", "โรงพยาบาลกรุงเทพพัทยา", "曼谷芭提雅医院"],
    category: "hospital",
    id: "pattaya-bangkok-hospital",
    label: "Bangkok Hospital Pattaya",
    location: { latitude: 12.9495, longitude: 100.9088 },
    market: "pattaya"
  },
  {
    aliases: ["pattaya city hospital", "city hospital", "городская больница", "โรงพยาบาลเมืองพัทยา", "芭提雅市医院"],
    category: "hospital",
    id: "pattaya-city-hospital",
    label: "Pattaya City Hospital",
    location: { latitude: 12.9368, longitude: 100.8875 },
    market: "pattaya"
  },
  {
    aliases: ["regents international school", "regents school", "регентс", "โรงเรียนนานาชาติรีเจ้นท์", "瑞金特国际学校"],
    category: "school",
    id: "pattaya-regents-school",
    label: "Regents International School Pattaya",
    location: { latitude: 12.9675, longitude: 100.9908 },
    market: "pattaya"
  },
  {
    aliases: ["big c extra", "big c", "биг си", "บิ๊กซี", "big c 芭提雅"],
    category: "supermarket",
    id: "pattaya-big-c-extra",
    label: "Big C Extra Pattaya",
    location: { latitude: 12.9394, longitude: 100.896 },
    market: "pattaya"
  },
  {
    aliases: ["phuket airport", "hkt", "аэропорт пхукет", "สนามบินภูเก็ต", "普吉机场"],
    category: "airport",
    id: "phuket-airport",
    label: "Phuket International Airport",
    location: { latitude: 8.1132, longitude: 98.3169 },
    market: "phuket"
  },
  {
    aliases: ["central phuket", "central festival phuket", "централ пхукет", "เซ็นทรัลภูเก็ต", "普吉中央"],
    category: "mall",
    id: "phuket-central",
    label: "Central Phuket",
    location: { latitude: 7.8917, longitude: 98.3686 },
    market: "phuket"
  },
  {
    aliases: ["bumrungrad", "bumrungrad hospital", "бумрунград", "โรงพยาบาลบำรุงราษฎร์", "康民医院"],
    category: "hospital",
    id: "bangkok-bumrungrad",
    label: "Bumrungrad International Hospital",
    location: { latitude: 13.746, longitude: 100.552 },
    market: "bangkok"
  },
  {
    aliases: ["central world", "centralworld", "централ ворлд", "เซ็นทรัลเวิลด์", "中央世界"],
    category: "mall",
    id: "bangkok-central-world",
    label: "CentralWorld",
    location: { latitude: 13.7466, longitude: 100.5393 },
    market: "bangkok"
  }
];

const CATEGORY_ALIASES: Record<CityPoiCategory, string[]> = {
  airport: ["airport", "аэропорт", "สนามบิน", "机场", "機場"],
  beach: ["beach", "sea", "пляж", "море", "ชายหาด", "ทะเล", "海滩", "海灘", "海边", "海邊"],
  hospital: ["hospital", "clinic", "больница", "госпиталь", "клиника", "โรงพยาบาล", "医院", "醫院"],
  landmark: ["landmark", "attraction", "temple", "market", "достопримечательность", "храм", "рынок", "สถานที่", "วัด", "景点", "景點"],
  mall: ["mall", "shopping", "shopping mall", "center", "centre", "тц", "молл", "торговый", "ห้าง", "ศูนย์การค้า", "商场", "商場"],
  nightlife: ["nightlife", "bars", "walking street", "bar street", "ночная жизнь", "бары", "ผับ", "บาร์", "酒吧", "夜生活"],
  park: ["park", "парк", "สวน", "公园", "公園"],
  pier: ["pier", "ferry", "пирс", "причал", "ท่าเรือ", "码头", "碼頭"],
  school: ["school", "kindergarten", "школа", "садик", "детский сад", "โรงเรียน", "学校", "學校"],
  supermarket: ["supermarket", "grocery", "big c", "lotus", "makro", "супермаркет", "магазин", "ซูเปอร์มาร์เก็ต", "超市"],
  transport: ["station", "bus station", "terminal", "transport", "станция", "автовокзал", "สถานี", "车站", "車站"]
};

const MARKET_SEARCH_LABELS: Record<ThailandMarket, string> = {
  bangkok: "Bangkok, Thailand",
  "hua-hin": "Hua Hin, Thailand",
  "koh-samui": "Koh Samui, Thailand",
  pattaya: "Pattaya, Thailand",
  phuket: "Phuket, Thailand"
};

interface GeocodedPlace {
  label: string;
  location: GeoPoint;
}

@Injectable()
export class LocationIntelligenceService {
  private readonly logger = new Logger(LocationIntelligenceService.name);

  async resolveComparisonTarget(message: string, market?: ThailandMarket): Promise<LocationComparisonTarget | undefined> {
    const localTarget = resolveLocationComparisonTarget(message, market);

    if (localTarget) {
      return localTarget;
    }

    const query = extractLocationQuery(message);

    if (!query) {
      return undefined;
    }

    const geocodedPlace = await this.geocode(query, market);

    if (!geocodedPlace) {
      return undefined;
    }

    return {
      kind: "poi",
      poi: {
        aliases: [query],
        category: "landmark",
        id: `geocoded-${stablePlaceId(geocodedPlace.label)}`,
        label: geocodedPlace.label,
        location: geocodedPlace.location,
        market: market ?? "pattaya"
      }
    };
  }

  private async geocode(query: string, market?: ThailandMarket): Promise<GeocodedPlace | undefined> {
    const provider = resolveMapGeocodingProvider();

    if (provider === "none") {
      return undefined;
    }

    try {
      if (provider === "google") {
        return await geocodeWithGoogle(query, market);
      }

      return await geocodeWithMapbox(query, market);
    } catch (error) {
      this.logger.warn(`Map geocoding failed: ${error instanceof Error ? error.message : String(error)}`);

      return undefined;
    }
  }
}

export function isLocationInfrastructureQuestion(message: string): boolean {
  return Boolean(resolveLocationComparisonTarget(message) || extractLocationQuery(message));
}

export function resolveLocationComparisonTarget(message: string, market?: ThailandMarket): LocationComparisonTarget | undefined {
  const normalized = normalizeLocationText(message);
  const marketPois = market ? CITY_POIS.filter((poi) => poi.market === market) : CITY_POIS;
  const namedPoi = marketPois.find((poi) => poi.aliases.some((alias) => normalized.includes(normalizeLocationText(alias))));

  if (namedPoi) {
    return { kind: "poi", poi: namedPoi };
  }

  const category = (Object.entries(CATEGORY_ALIASES) as Array<[CityPoiCategory, string[]]>).find(([, aliases]) =>
    aliases.some((alias) => normalized.includes(normalizeLocationText(alias)))
  )?.[0];

  if (!category || category === "beach") {
    return undefined;
  }

  const pois = marketPois.filter((poi) => poi.category === category);

  if (!pois.length) {
    return undefined;
  }

  return {
    category,
    kind: "category",
    label: `the nearest ${category}`,
    pois
  };
}

export function comparePropertiesToLocationTarget(
  properties: PropertySnapshot[],
  target: LocationComparisonTarget
): PropertyLocationDistance[] {
  return properties
    .map((property) => {
      const nearestTarget = nearestPoiForProperty(property, target);

      return {
        distanceMeters: Math.round(distanceMeters(property.location, nearestTarget.location)),
        property,
        targetLabel: nearestTarget.label
      };
    })
    .sort((left, right) => left.distanceMeters - right.distanceMeters);
}

export function formatDistance(distanceMeters: number): string {
  if (distanceMeters >= 10_000) {
    return `${Number((distanceMeters / 1000).toFixed(1))}km`;
  }

  if (distanceMeters >= 1000) {
    return `${Number((distanceMeters / 1000).toFixed(2))}km`;
  }

  return `${distanceMeters}m`;
}

function nearestPoiForProperty(property: PropertySnapshot, target: LocationComparisonTarget): CityPoi {
  if (target.kind === "poi") {
    return target.poi;
  }

  return [...target.pois].sort(
    (left, right) => distanceMeters(property.location, left.location) - distanceMeters(property.location, right.location)
  )[0]!;
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

function normalizeLocationText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLocationQuery(message: string): string | undefined {
  const normalizedWhitespace = message.replace(/\s+/g, " ").trim();
  const patterns = [
    /\b(?:close|closer|closest|near|nearer|nearest|distance|far|farther|farthest)\s+(?:to|from)\s+(.+?)(?:\?|$)/i,
    /\b(?:to|from)\s+(.+?)(?:\?|$)/i,
    /(?:рядом|ближе|близко|далеко)\s+(?:к|до|от)\s+(.+?)(?:\?|$)/i
  ];
  const value = patterns
    .map((pattern) => normalizedWhitespace.match(pattern)?.[1])
    .find((match): match is string => Boolean(match?.trim()));

  if (!value) {
    return undefined;
  }

  const cleaned = value
    .replace(/\b(?:among|between|these|those|them|options|listings|ones|which one|which of them|which option)\b/gi, " ")
    .replace(/\b(?:is|are|the|a|an|more|most)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || CATEGORY_ALIASES.beach.some((alias) => normalizeLocationText(cleaned) === normalizeLocationText(alias))) {
    return undefined;
  }

  return cleaned;
}

function resolveMapGeocodingProvider(): "google" | "mapbox" | "none" {
  const requestedProvider = process.env.MAP_GEOCODING_PROVIDER?.trim().toLowerCase();

  if (requestedProvider === "google" || (!requestedProvider && process.env.GOOGLE_MAPS_API_KEY?.trim())) {
    return "google";
  }

  if (requestedProvider === "mapbox" || (!requestedProvider && process.env.MAPBOX_ACCESS_TOKEN?.trim())) {
    return "mapbox";
  }

  return "none";
}

async function geocodeWithGoogle(query: string, market?: ThailandMarket): Promise<GeocodedPlace | undefined> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

  if (!apiKey) {
    return undefined;
  }

  const params = new URLSearchParams({
    address: buildGeocodingQuery(query, market),
    key: apiKey,
    region: "th"
  });
  const response = await fetchJson<{ results?: Array<{ formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } }> }>(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
  );
  const first = response.results?.[0];

  if (!first) {
    return undefined;
  }

  const location = first?.geometry?.location;

  if (typeof location?.lat !== "number" || typeof location.lng !== "number") {
    return undefined;
  }

  return {
    label: first.formatted_address?.split(",")[0]?.trim() || query,
    location: { latitude: location.lat, longitude: location.lng }
  };
}

async function geocodeWithMapbox(query: string, market?: ThailandMarket): Promise<GeocodedPlace | undefined> {
  const accessToken = process.env.MAPBOX_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    return undefined;
  }

  const params = new URLSearchParams({
    access_token: accessToken,
    country: "TH",
    limit: "1"
  });
  const encodedQuery = encodeURIComponent(buildGeocodingQuery(query, market));
  const response = await fetchJson<{ features?: Array<{ center?: [number, number]; text?: string; place_name?: string }> }>(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?${params.toString()}`
  );
  const first = response.features?.[0];

  if (!first) {
    return undefined;
  }

  const center = first?.center;

  if (!Array.isArray(center) || typeof center[0] !== "number" || typeof center[1] !== "number") {
    return undefined;
  }

  return {
    label: first.text?.trim() || first.place_name?.split(",")[0]?.trim() || query,
    location: { latitude: center[1], longitude: center[0] }
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function buildGeocodingQuery(query: string, market?: ThailandMarket): string {
  const marketLabel = market ? MARKET_SEARCH_LABELS[market] : "Thailand";
  const normalizedQuery = query.toLowerCase();

  return normalizedQuery.includes("thailand") || normalizedQuery.includes(marketLabel.toLowerCase())
    ? query
    : `${query}, ${marketLabel}`;
}

function stablePlaceId(value: string): string {
  return normalizeLocationText(value).replace(/\s+/g, "-").slice(0, 64) || "place";
}
