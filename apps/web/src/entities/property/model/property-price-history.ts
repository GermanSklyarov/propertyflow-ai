import type { PropertySnapshot } from "@propertyflow/domain";
import { formatCompactThb } from "@shared/lib/format-money";

export type PropertyPriceHistoryPoint = {
  label: string;
  value: number;
};

export type PropertyPriceHistory = {
  changeLabel: string;
  points: PropertyPriceHistoryPoint[];
  trend: "up" | "flat" | "down";
};

const historyYears = ["2021", "2022", "2023", "2024", "2025"];

export function buildPropertyPriceHistory(property: PropertySnapshot): PropertyPriceHistory {
  const multipliers = getMarketMultipliers(property);
  const points = historyYears.map((label, index) => ({
    label,
    value: Math.round(property.price.amount * multipliers[index])
  }));
  const firstValue = points[0]?.value ?? property.price.amount;
  const lastValue = points.at(-1)?.value ?? property.price.amount;
  const changePercent = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

  return {
    changeLabel: `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}% since ${historyYears[0]}`,
    points,
    trend: Math.abs(changePercent) < 1 ? "flat" : changePercent > 0 ? "up" : "down"
  };
}

export function getPriceHistoryBars(history: PropertyPriceHistory) {
  const maxValue = Math.max(...history.points.map((point) => point.value));

  return history.points.map((point) => ({
    ...point,
    heightPercent: maxValue > 0 ? Math.max(16, Math.round((point.value / maxValue) * 100)) : 16,
    valueLabel: formatCompactThb(point.value)
  }));
}

function getMarketMultipliers(property: PropertySnapshot) {
  if (property.address?.toLowerCase().includes("wongamat")) {
    return [0.82, 0.86, 0.91, 0.96, 1];
  }

  if (property.address?.toLowerCase().includes("jomtien")) {
    return [0.86, 0.89, 0.93, 0.97, 1];
  }

  return [0.9, 0.92, 0.95, 0.98, 1];
}
