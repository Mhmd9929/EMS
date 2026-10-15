import type { Prisma } from "@prisma/client";

const REDACTED_KEYS = new Set(["passwordHash", "tokenHash", "password", "currentPassword", "confirmPassword"]);

/** JSON-safe snapshot: dates → ISO strings, bigint → string, secrets removed. */
export function toAuditJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(
    JSON.stringify(value, (key, v) => {
      if (REDACTED_KEYS.has(key)) return "[redacted]";
      if (typeof v === "bigint") return v.toString();
      return v;
    }),
  );
}

/** Keys whose values differ between two snapshots (shallow). */
export function changedKeys(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined) {
  const b = (toAuditJson(before) ?? {}) as Record<string, unknown>;
  const a = (toAuditJson(after) ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  return [...keys].filter((k) => k !== "updatedAt" && JSON.stringify(b[k]) !== JSON.stringify(a[k]));
}

/** Only the fields that changed, for compact before/after records. */
export function diffSnapshots(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = changedKeys(before, after);
  const pick = (o: Record<string, unknown>) => Object.fromEntries(keys.map((k) => [k, o[k] ?? null]));
  return { keys, before: pick(before), after: pick(after) };
}
