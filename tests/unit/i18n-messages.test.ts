import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NAMESPACES } from "@/i18n/config";

const load = (locale: string, ns: string) => JSON.parse(readFileSync(path.join("messages", locale, `${ns}.json`), "utf8"));

/** Flatten nested messages into "a.b.c" → string. */
function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") Object.assign(acc, flatten(v as Record<string, unknown>, key));
    else acc[key] = String(v);
    return acc;
  }, {});
}
/** Top-level ICU arguments ({name}, {count, plural, …}) — nested plural branches excluded. */
function args(msg: string) {
  const out = new Set<string>();
  let depth = 0;
  for (let i = 0; i < msg.length; i++) {
    if (msg[i] === "{") {
      if (depth === 0) {
        const m = /^\{\s*([a-zA-Z0-9_]+)/.exec(msg.slice(i));
        if (m) out.add(m[1]);
      }
      depth++;
    } else if (msg[i] === "}") depth--;
  }
  return [...out].sort();
}

describe("translations", () => {
  for (const ns of NAMESPACES) {
    it(`${ns}: Arabic has exactly the English keys and the same placeholders`, () => {
      const en = flatten(load("en", ns));
      const ar = flatten(load("ar", ns));
      expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
      for (const key of Object.keys(en)) {
        expect({ key, args: args(ar[key]) }).toEqual({ key, args: args(en[key]) });
        expect(ar[key].trim(), `${ns}.${key} is empty`).not.toBe("");
      }
    });
  }

  it("message keys never contain dots (next-intl uses them as separators)", () => {
    const walk = (o: Record<string, unknown>): string[] => Object.entries(o).flatMap(([k, v]) => [k, ...(v && typeof v === "object" ? walk(v as Record<string, unknown>) : [])]);
    for (const ns of NAMESPACES) for (const k of walk(load("en", ns))) expect(k).not.toContain(".");
  });
});
