/** Amount in words for payslips, e.g. "Twelve Thousand Three Hundred Forty-Five UAE Dirhams and Fifty Fils Only". */
import { decimalsOf } from "./money";

const ONES = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const SCALES: [number, string][] = [
  [1_000_000_000, "Billion"],
  [1_000_000, "Million"],
  [1_000, "Thousand"],
];

const UNITS: Record<string, [string, string, string]> = {
  AED: ["UAE Dirham", "UAE Dirhams", "Fils"],
  SAR: ["Saudi Riyal", "Saudi Riyals", "Halalas"],
  QAR: ["Qatari Riyal", "Qatari Riyals", "Dirhams"],
  KWD: ["Kuwaiti Dinar", "Kuwaiti Dinars", "Fils"],
  BHD: ["Bahraini Dinar", "Bahraini Dinars", "Fils"],
  OMR: ["Omani Rial", "Omani Rials", "Baisa"],
  USD: ["US Dollar", "US Dollars", "Cents"],
  EUR: ["Euro", "Euros", "Cents"],
  GBP: ["Pound Sterling", "Pounds Sterling", "Pence"],
};

function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""));
  else if (n > 0) parts.push(ONES[n]);
  return parts.join(" ");
}

export function integerInWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError("Expected a non-negative integer");
  if (n === 0) return ONES[0];
  const parts: string[] = [];
  for (const [value, name] of SCALES) {
    if (n >= value) {
      parts.push(`${below1000(Math.floor(n / value))} ${name}`);
      n %= value;
    }
  }
  if (n) parts.push(below1000(n));
  return parts.join(" ");
}

export function amountInWords(minor: number, currency: string): string {
  const d = decimalsOf(currency);
  const [one, many, sub] = UNITS[currency] ?? [currency, currency, "cents"];
  const abs = Math.abs(Math.round(minor));
  const major = Math.floor(abs / 10 ** d);
  const fraction = abs % 10 ** d;
  let text = `${integerInWords(major)} ${major === 1 ? one : many}`;
  if (fraction) text += ` and ${integerInWords(fraction)} ${sub}`;
  return `${minor < 0 ? "Minus " : ""}${text} Only`;
}
