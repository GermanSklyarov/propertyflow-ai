import type { PropertySnapshot } from "@propertyflow/domain";
import { getBeachScore, getGrossYield, getNeighborhoodRows } from "./property-brief";

export type MarketSnapshotMetric = {
  label: string;
  value: string;
};

export type MarketSnapshot = {
  heroMetrics: MarketSnapshotMetric[];
  surfaceMetrics: MarketSnapshotMetric[];
};

export function buildMarketSnapshot(properties: PropertySnapshot[]): MarketSnapshot {
  return {
    heroMetrics: [
      { label: "Curated matches", value: `${properties.length}+` },
      { label: "Top yield signal", value: formatPercent(getTopYield(properties)) },
      { label: "Walkability fit", value: `${getAverageWalkability(properties).toFixed(1)}/5` }
    ],
    surfaceMetrics: [
      { label: "Primary market", value: getPrimaryMarket(properties) },
      { label: "Rent-ready", value: `${countRentReady(properties)}` },
      { label: "Buy-ready", value: `${countBuyReady(properties)}` }
    ]
  };
}

function getTopYield(properties: PropertySnapshot[]) {
  const yields = properties.map(getGrossYield).filter((value): value is number => value !== undefined);

  return yields.length ? Math.max(...yields) : undefined;
}

function getAverageWalkability(properties: PropertySnapshot[]) {
  if (!properties.length) {
    return 0;
  }

  const total = properties.reduce((sum, property) => {
    const shoppingScore = getNeighborhoodRows(property).find((row) => row.label === "Shopping")?.value ?? 3;

    return sum + (getBeachScore(property) + shoppingScore) / 2;
  }, 0);

  return total / properties.length;
}

function getPrimaryMarket(properties: PropertySnapshot[]) {
  return properties[0]?.market ?? "Thailand";
}

function countRentReady(properties: PropertySnapshot[]) {
  return properties.filter((property) => property.listingType === "rent" || property.listingType === "sale_or_rent").length;
}

function countBuyReady(properties: PropertySnapshot[]) {
  return properties.filter((property) => property.listingType === "sale" || property.listingType === "sale_or_rent").length;
}

function formatPercent(value: number | undefined) {
  return value !== undefined ? `${value.toFixed(1)}%` : "Pending";
}
