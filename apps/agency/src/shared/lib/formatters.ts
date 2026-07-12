export function formatPercent(value: number, options: { maximumFractionDigits?: number } = {}) {
  const percent = Math.abs(value) <= 1 ? value * 100 : value;

  return `${new Intl.NumberFormat("en", {
    maximumFractionDigits: options.maximumFractionDigits ?? 0
  }).format(percent)}%`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(value));
}

export function formatBucket(value: string) {
  return value.replaceAll("-", " ").replaceAll("_", " ");
}
