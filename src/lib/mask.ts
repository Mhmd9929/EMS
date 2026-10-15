/** Mask all but the last `visible` characters, keeping separators for readability. */
export function maskTail(value: string | null | undefined, visible = 4) {
  if (!value) return "";
  const chars = [...value];
  let toKeep = visible;
  for (let i = chars.length - 1; i >= 0; i--) {
    if (/[A-Za-z0-9]/.test(chars[i])) {
      if (toKeep > 0) toKeep--;
      else chars[i] = "•";
    }
  }
  return chars.join("");
}

/** Emirates ID: 784-YYYY-NNNNNNN-C -> 784-••••-•••••••-C style, keeping the last digit. */
export function maskEmiratesId(value: string | null | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 15) return maskTail(value, 2);
  return `${digits.slice(0, 3)}-••••-•••••••-${digits.slice(14)}`;
}

export const EMIRATES_ID_REGEX = /^784-?\d{4}-?\d{7}-?\d$/;

export function formatEmiratesId(value: string) {
  const d = value.replace(/\D/g, "");
  if (d.length !== 15) return value;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 14)}-${d.slice(14)}`;
}
