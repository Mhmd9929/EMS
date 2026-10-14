import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError, type ZodType, type z } from "zod";
import { AppError } from "@/server/errors";
import { formDataToObject } from "@/lib/validation/common";
import type { ActionResult } from "@/lib/action-result";

function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Execute an action body and convert known failures into a serialisable result. */
export async function runAction<T>(fn: () => Promise<T | ActionResult<T>>, successMessage?: string): Promise<ActionResult<T>> {
  try {
    const value = await fn();
    if (value && typeof value === "object" && "ok" in value) return value as ActionResult<T>;
    return { ok: true, data: value as T, message: successMessage };
  } catch (error) {
    unstable_rethrow(error); // let redirect()/notFound()/forbidden() through
    if (error instanceof ZodError) {
      return { ok: false, error: "Please correct the highlighted fields.", fieldErrors: zodFieldErrors(error) };
    }
    if (error instanceof AppError) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    console.error("[action] unexpected error", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Parse FormData (or a plain object) with a Zod schema; throws ZodError on failure. */
export function parseInput<S extends ZodType>(schema: S, input: FormData | Record<string, unknown>): z.output<S> {
  const data = input instanceof FormData ? formDataToObject(input) : input;
  return schema.parse(data);
}
