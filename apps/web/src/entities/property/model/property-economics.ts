import type { PropertySnapshot } from "@propertyflow/domain";
import { formatCompactThb } from "@shared/lib/format-money";
import { getGrossYield } from "./property-brief";

export type PropertyEconomicsRow = {
  label: string;
  value: string;
};

export type PropertyEconomics = {
  calculatorRows: PropertyEconomicsRow[];
  netMonthlyIncome?: number;
  netYield?: number;
  operatingReserveMonthly?: number;
  ownershipMonthlyCost?: number;
  paybackYears?: number;
  transferCostBuffer?: number;
};

const operatingReserveRate = 0.1;
const transferCostBufferRate = 0.03;

export function buildPropertyEconomics(property: PropertySnapshot): PropertyEconomics {
  const monthlyRent = property.monthlyRentEstimate?.amount;
  const maintenanceFee = property.maintenanceFeeMonthly?.amount ?? 0;
  const operatingReserveMonthly = monthlyRent ? Math.round(monthlyRent * operatingReserveRate) : undefined;
  const ownershipMonthlyCost = operatingReserveMonthly !== undefined ? maintenanceFee + operatingReserveMonthly : maintenanceFee || undefined;
  const netMonthlyIncome =
    monthlyRent !== undefined && ownershipMonthlyCost !== undefined ? monthlyRent - ownershipMonthlyCost : undefined;
  const netYield =
    netMonthlyIncome !== undefined && property.price.amount > 0 ? ((netMonthlyIncome * 12) / property.price.amount) * 100 : undefined;
  const paybackYears = netMonthlyIncome && netMonthlyIncome > 0 ? property.price.amount / (netMonthlyIncome * 12) : undefined;
  const transferCostBuffer = property.listingType === "rent" ? undefined : Math.round(property.price.amount * transferCostBufferRate);

  return {
    calculatorRows: [
      { label: "Gross yield", value: formatPercent(getGrossYield(property)) },
      { label: "Net yield estimate", value: formatPercent(netYield) },
      { label: "Net monthly income", value: netMonthlyIncome !== undefined ? formatCompactThb(netMonthlyIncome) : "Pending" },
      { label: "Monthly holding cost", value: ownershipMonthlyCost !== undefined ? formatCompactThb(ownershipMonthlyCost) : "Pending" },
      { label: "Operating reserve", value: operatingReserveMonthly !== undefined ? formatCompactThb(operatingReserveMonthly) : "Pending" },
      { label: "Payback period", value: paybackYears ? `${paybackYears.toFixed(1)} years` : "Pending" },
      { label: "Transfer cost buffer", value: transferCostBuffer !== undefined ? formatCompactThb(transferCostBuffer) : "Not needed for rent" }
    ],
    netMonthlyIncome,
    netYield,
    operatingReserveMonthly,
    ownershipMonthlyCost,
    paybackYears,
    transferCostBuffer
  };
}

function formatPercent(value: number | undefined) {
  return value !== undefined ? `${value.toFixed(1)}%` : "Pending";
}
