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

// ───────────────────────────── Arabic ─────────────────────────────
// e.g. "فقط اثنا عشر ألفًا وثلاثمائة وخمسة وأربعون درهمًا إماراتيًا وخمسون فلسًا لا غير".
// Counted-noun agreement: 1 → noun + واحد, 2 → dual, 3–10 → plural, 11–99 → accusative singular,
// otherwise (0, 100, 1000 …) genitive singular. Number words are masculine except for feminine minor units.

type ArNoun = { one: string; two: string; few: string; many: string; fem?: boolean };

const AR_ONES_M = ["صفر", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة"];
const AR_ONES_F = ["صفر", "واحدة", "اثنتان", "ثلاث", "أربع", "خمس", "ست", "سبع", "ثماني", "تسع", "عشر"];
const AR_TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const AR_HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
const AR_SCALES: [number, ArNoun][] = [
  [1_000_000_000, { one: "مليار", two: "ملياران", few: "مليارات", many: "مليارًا" }],
  [1_000_000, { one: "مليون", two: "مليونان", few: "ملايين", many: "مليونًا" }],
  [1_000, { one: "ألف", two: "ألفان", few: "آلاف", many: "ألفًا" }],
];

const AR_UNITS: Record<string, [ArNoun, ArNoun]> = {
  AED: [{ one: "درهم إماراتي", two: "درهمان إماراتيان", few: "دراهم إماراتية", many: "درهمًا إماراتيًا" }, { one: "فلس", two: "فلسان", few: "فلوس", many: "فلسًا" }],
  SAR: [{ one: "ريال سعودي", two: "ريالان سعوديان", few: "ريالات سعودية", many: "ريالًا سعوديًا" }, { one: "هللة", two: "هللتان", few: "هللات", many: "هللة", fem: true }],
  QAR: [{ one: "ريال قطري", two: "ريالان قطريان", few: "ريالات قطرية", many: "ريالًا قطريًا" }, { one: "درهم", two: "درهمان", few: "دراهم", many: "درهمًا" }],
  KWD: [{ one: "دينار كويتي", two: "ديناران كويتيان", few: "دنانير كويتية", many: "دينارًا كويتيًا" }, { one: "فلس", two: "فلسان", few: "فلوس", many: "فلسًا" }],
  BHD: [{ one: "دينار بحريني", two: "ديناران بحرينيان", few: "دنانير بحرينية", many: "دينارًا بحرينيًا" }, { one: "فلس", two: "فلسان", few: "فلوس", many: "فلسًا" }],
  OMR: [{ one: "ريال عماني", two: "ريالان عمانيان", few: "ريالات عمانية", many: "ريالًا عمانيًا" }, { one: "بيسة", two: "بيستان", few: "بيسات", many: "بيسة", fem: true }],
  USD: [{ one: "دولار أمريكي", two: "دولاران أمريكيان", few: "دولارات أمريكية", many: "دولارًا أمريكيًا" }, { one: "سنت", two: "سنتان", few: "سنتات", many: "سنتًا" }],
  EUR: [{ one: "يورو", two: "يورو", few: "يورو", many: "يورو" }, { one: "سنت", two: "سنتان", few: "سنتات", many: "سنتًا" }],
  GBP: [{ one: "جنيه إسترليني", two: "جنيهان إسترلينيان", few: "جنيهات إسترلينية", many: "جنيهًا إسترلينيًا" }, { one: "بنس", two: "بنسان", few: "بنسات", many: "بنسًا" }],
};

function below1000Ar(n: number, fem = false): string {
  const ones = fem ? AR_ONES_F : AR_ONES_M;
  const parts: string[] = [];
  if (n >= 100) parts.push(AR_HUNDREDS[Math.floor(n / 100)]);
  const r = n % 100;
  if (r === 0) {
    // nothing
  } else if (r <= 10) {
    parts.push(ones[r]);
  } else if (r < 20) {
    if (r === 11) parts.push(fem ? "إحدى عشرة" : "أحد عشر");
    else if (r === 12) parts.push(fem ? "اثنتا عشرة" : "اثنا عشر");
    else parts.push(`${ones[r - 10]} ${fem ? "عشرة" : "عشر"}`);
  } else {
    const u = r % 10;
    const tens = AR_TENS[Math.floor(r / 10)];
    parts.push(u === 0 ? tens : `${ones[u]} و${tens}`);
  }
  return parts.join(" و");
}

/**
 * A number ending in a scale word is in construct with the counted noun: "مائتان" / "ألفان" → "مائتا" / "ألفا",
 * and "ألفًا" / "مليونًا" lose their tanween ("خمسة عشر ألف درهم").
 */
const construct = (words: string) => words.replace(/(مائتان|ألفان|مليونان|ملياران)$/, (w) => w.slice(0, -1)).replace(/(ألف|مليون|مليار)ًا$/, "$1");

/** Count + noun with Arabic agreement, e.g. 3 → "ثلاثة آلاف", 11 → "أحد عشر ألفًا", 1 → "ألف". */
function countedAr(n: number, noun: ArNoun, numberWords: (n: number) => string, oneWord?: string): string {
  if (n === 1) return oneWord ? `${noun.one} ${oneWord}` : noun.one;
  if (n === 2) return noun.two;
  if (n === 0) return `${numberWords(0)} ${noun.one}`;
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${numberWords(n)} ${noun.few}`;
  if (r >= 11) return `${numberWords(n)} ${noun.many}`;
  return `${construct(numberWords(n))} ${noun.one}`;
}

/** Arabic words for a non-negative integer (masculine; `fem` for feminine nouns below 1000). */
export function integerInWordsAr(n: number, fem = false): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError("Expected a non-negative integer");
  if (n === 0) return AR_ONES_M[0];
  const parts: string[] = [];
  for (const [value, noun] of AR_SCALES) {
    if (n >= value) {
      parts.push(countedAr(Math.floor(n / value), noun, (c) => below1000Ar(c)));
      n %= value;
    }
  }
  if (n) parts.push(below1000Ar(n, fem));
  return parts.join(" و");
}

/** Arabic amount in words for payslips, e.g. "فقط ألف درهم إماراتي وخمسون فلسًا لا غير". */
export function amountInWordsAr(minor: number, currency: string): string {
  const d = decimalsOf(currency);
  const generic: ArNoun = { one: currency, two: currency, few: currency, many: currency };
  const [major, sub] = AR_UNITS[currency] ?? [generic, { one: "سنت", two: "سنتان", few: "سنتات", many: "سنتًا" }];
  const abs = Math.abs(Math.round(minor));
  const whole = Math.floor(abs / 10 ** d);
  const fraction = abs % 10 ** d;
  let text = countedAr(whole, major, (n) => integerInWordsAr(n), "واحد");
  if (fraction) text += ` و${countedAr(fraction, sub, (n) => integerInWordsAr(n, sub.fem), sub.fem ? "واحدة" : "واحد")}`;
  return `فقط ${minor < 0 ? "سالب " : ""}${text} لا غير`;
}
