import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError, type ZodType, type z } from "zod";
import { AppError, ForbiddenError, NotFoundError } from "@/server/errors";
import { getAppLocale, serverT } from "@/server/i18n";
import { translateIssue } from "@/server/validation-i18n";
import { formDataToObject } from "@/lib/validation/common";
import type { ActionResult } from "@/lib/action-result";

async function zodFieldErrors(error: ZodError): Promise<Record<string, string[]>> {
  const locale = await getAppLocale();
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(translateIssue(issue, locale));
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
    const t = await serverT("errors");
    if (error instanceof ZodError) {
      return { ok: false, error: t("fixFields"), fieldErrors: await zodFieldErrors(error) };
    }
    if (error instanceof AppError) {
      // Default messages of the generic errors are translated here; services pass already-translated text.
      const message =
        error instanceof ForbiddenError && error.message === ForbiddenError.DEFAULT
          ? t("forbidden")
          : error instanceof NotFoundError && error.message === NotFoundError.DEFAULT
            ? t("notFound")
            : error.message;
      return { ok: false, error: message, fieldErrors: error.fieldErrors };
    }
    console.error("[action] unexpected error", error);
    return { ok: false, error: t("unexpected") };
  }
}

/** Parse FormData (or a plain object) with a Zod schema; throws ZodError on failure. */
export function parseInput<S extends ZodType>(schema: S, input: FormData | Record<string, unknown>): z.output<S> {
  const data = input instanceof FormData ? formDataToObject(input) : input;
  return schema.parse(data);
}
