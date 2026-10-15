import type { SearchParams } from "@/lib/list-params";

/** Build an href from the current search params with some keys replaced (undefined/"" removes). */
export function hrefWith(pathname: string, current: SearchParams, updates: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.set(k, v);
  }
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined || v === null || v === "") sp.delete(k);
    else sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
