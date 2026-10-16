import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { brand } from "@/theme/brand";

const cache = new Map<string, Promise<Buffer | null>>();

/** A file from /public/brand (logo-full.png, logo-icon.png …), or null when it is not installed. */
export function readBrandAsset(kind: "full" | "icon"): Promise<Buffer | null> {
  const rel = brand.logos[kind];
  if (!cache.has(rel)) {
    cache.set(
      rel,
      readFile(path.join(process.cwd(), "public", rel)).catch(() => {
        cache.delete(rel); // retry next time: the file may be added without a restart
        return null;
      }),
    );
  }
  return cache.get(rel)!;
}
