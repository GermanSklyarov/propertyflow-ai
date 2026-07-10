export function formatCompactThb(amount: number) {
  return new Intl.NumberFormat("en-US", {
    compactDisplay: "short",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
    currency: "THB"
  }).format(amount);
}
