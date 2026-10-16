import "server-only";
import { z, type ZodError } from "zod";
import type { AppLocale } from "@/i18n/config";
import arDictionary from "../../messages/ar/validation.json";

const dictionaries: Partial<Record<AppLocale, Record<string, string>>> = { ar: arDictionary };
const en = z.locales.en().localeError;
const builtIn: Partial<Record<AppLocale, typeof en>> = { ar: z.locales.ar().localeError };

/**
 * Translate a Zod issue message. Our own schema messages (shared with the forms, written in English)
 * are looked up in messages/<locale>/validation.json; Zod's built-in messages use Zod's own locale.
 */
export function translateIssue(issue: ZodError["issues"][number], locale: AppLocale): string {
  if (locale === "en") return issue.message;
  const dict = dictionaries[locale] ?? {};
  if (dict[issue.message]) return dict[issue.message];
  const max = /^Max (\d+) characters$/.exec(issue.message);
  if (max && dict["Max {n} characters"]) return dict["Max {n} characters"].replace("{n}", max[1]);
  // Built-in message (identical to Zod's English default) → Zod's translation.
  const local = builtIn[locale];
  const raw = issue as unknown as Parameters<typeof en>[0];
  const asEnglish = en(raw);
  const englishText = typeof asEnglish === "string" ? asEnglish : asEnglish?.message;
  if (local && englishText === issue.message) {
    const t = local(raw);
    return (typeof t === "string" ? t : t?.message) ?? issue.message;
  }
  return issue.message;
}
