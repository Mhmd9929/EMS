/**
 * Money helpers. Amounts are integers in the currency's minor unit (fils for AED). Conversion to/from
 * decimal strings is done on strings so 0.1 + 0.2 style float errors never reach the database.
 */
export const CURRENCY_DECIMALS: Record<string, number> = {
  AED: 2, SAR: 2, QAR: 2, USD: 2, EUR: 2, GBP: 2, KWD: 3, BHD: 3, OMR: 3,
};

export const decimalsOf = (currency: string) => CURRENCY_DECIMALS[currency] ?? 2;

/** "1,234.5" | 1234.5 → 123450 (AED). Throws on invalid input. */
export function toMinor(value: string | number, currency: string): number {
  const d = decimalsOf(currency);
  const raw = typeof value === "number" ? value.toFixed(d) : value.replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new RangeError(`Invalid amount: ${value}`);
  const negative = raw.startsWith("-");
  const [int, frac = ""] = raw.replace("-", "").split(".");
  if (frac.length > d && /[1-9]/.test(frac.slice(d))) throw new RangeError(`Too many decimals for ${currency}: ${value}`);
  const minor = Number(int) * 10 ** d + Number((frac + "0".repeat(d)).slice(0, d));
  return negative ? -minor : minor;
}

export function toMajor(minor: number | bigint, currency: string): number {
  return Number(minor) / 10 ** decimalsOf(currency);
}

/** Decimal string without grouping, e.g. for files: 123450 → "1234.50". */
export function minorToDecimalString(minor: number | bigint, currency: string): string {
  const d = decimalsOf(currency);
  const n = Number(minor);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const int = Math.floor(abs / 10 ** d);
  const frac = String(abs % 10 ** d).padStart(d, "0");
  return d ? `${sign}${int}.${frac}` : `${sign}${int}`;
}

export function formatMoney(minor: number | bigint, currency: string, opts: { withCode?: boolean } = {}): string {
  const d = decimalsOf(currency);
  const s = new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(minor) / 10 ** d);
  return opts.withCode === false ? s : `${currency} ${s}`;
}

export const sumMinor = (values: (number | bigint)[]) => values.reduce<number>((a, v) => a + Number(v), 0);
