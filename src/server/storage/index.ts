import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "@/server/env";
import { ValidationError } from "@/server/errors";

/** Pluggable object storage. Local disk today; an S3 implementation can satisfy the same interface. */
export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ data: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

const KEY_PATTERN = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.[a-z0-9]+$/;

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

class LocalDiskStorage implements Storage {
  constructor(private readonly root: string) {}

  private resolve(key: string) {
    if (!KEY_PATTERN.test(key)) throw new Error("Invalid storage key");
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async get(key: string) {
    try {
      const data = await readFile(this.resolve(key));
      const ext = key.split(".").pop() ?? "";
      return { data, contentType: CONTENT_TYPES[ext] ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await unlink(this.resolve(key)).catch(() => undefined);
  }
}

export const storage: Storage = new LocalDiskStorage(env.STORAGE_DIR);

type Kind = "png" | "jpg" | "webp" | "pdf";

/** Identify a file by its magic bytes — never trust the client-provided MIME type or extension. */
export function sniffFileType(buf: Buffer): Kind | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-") return "pdf";
  return null;
}

/** Validate an uploaded File and store it. Returns the storage key. */
export async function saveUpload(
  file: File,
  opts: { companyId: string; folder: string; allowed: Kind[]; maxMb?: number },
): Promise<string> {
  const maxBytes = (opts.maxMb ?? env.MAX_UPLOAD_MB) * 1024 * 1024;
  if (!file || file.size === 0) throw new ValidationError("Please choose a file.");
  if (file.size > maxBytes) throw new ValidationError(`File is too large (max ${opts.maxMb ?? env.MAX_UPLOAD_MB} MB).`);
  const data = Buffer.from(await file.arrayBuffer());
  const kind = sniffFileType(data);
  if (!kind || !opts.allowed.includes(kind)) {
    throw new ValidationError(`Unsupported file type. Allowed: ${opts.allowed.join(", ").toUpperCase()}.`);
  }
  const key = `${opts.companyId}/${opts.folder}/${randomUUID()}.${kind}`;
  await storage.put(key, data, CONTENT_TYPES[kind]);
  return key;
}
