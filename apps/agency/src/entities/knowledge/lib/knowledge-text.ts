export function excerpt(value: string, limit = 180) {
  return value.length > limit ? `${value.slice(0, limit - 3).trim()}...` : value;
}
