/**
 * IBAN validation (ISO 13616, mod-97) with country length checks.
 * UAE IBANs are 23 chars: AE + 2 check digits + 3-digit bank code + 16-digit account.
 */
const IBAN_LENGTHS: Record<string, number> = {
  AE: 23, SA: 24, BH: 22, KW: 30, QA: 29, OM: 23, GB: 22, DE: 22, FR: 27, NL: 18, ES: 24, IT: 27,
  CH: 21, JO: 30, LB: 28, EG: 29, PK: 24, TR: 26,
};

export function normalizeIban(input: string) {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  if (expected !== undefined && iban.length !== expected) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  // Convert letters to numbers (A=10 … Z=35) and compute mod 97 in chunks to avoid big ints.
  let remainder = 0;
  for (const ch of rearranged) {
    const value = ch >= "A" && ch <= "Z" ? (ch.charCodeAt(0) - 55).toString() : ch;
    for (const digit of value) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

/** "AE070331234567890123456" -> "AE07 0331 2345 6789 0123 456" */
export function formatIban(input: string) {
  return normalizeIban(input).replace(/(.{4})/g, "$1 ").trim();
}

/** Keep country + check digits and the last 4 characters. */
export function maskIban(input: string | null | undefined) {
  if (!input) return "";
  const iban = normalizeIban(input);
  if (iban.length <= 8) return "•".repeat(iban.length);
  return `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`;
}
