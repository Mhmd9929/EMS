export function formatEmployeeNumber(prefix: string, seq: number, padding: number) {
  return `${prefix}${String(seq).padStart(Math.max(0, padding), "0")}`;
}
