export function toIsoMaybe(value) {
  if (value == null || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
