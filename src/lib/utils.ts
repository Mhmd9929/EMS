import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(first?: string | null, last?: string | null) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

export function fullName(e: { firstName: string; lastName: string; preferredName?: string | null }) {
  return `${e.preferredName || e.firstName} ${e.lastName}`;
}

/** Turn arbitrary text into a stable machine key, e.g. "Team Lead" -> "TEAM_LEAD". */
export function toKey(text: string) {
  return text
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
