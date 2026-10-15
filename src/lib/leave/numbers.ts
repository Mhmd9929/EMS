/** Leave amounts are kept to 2 decimals. Work in hundredths to avoid float drift. */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function sum(values: number[]) {
  return round2(values.reduce((a, b) => a + Math.round(b * 100), 0) / 100);
}

/** Prisma Decimal | number | string → number. */
export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(String(value));
}

export function formatDays(n: number) {
  const v = round2(n);
  return `${v} ${Math.abs(v) === 1 ? "day" : "days"}`;
}
