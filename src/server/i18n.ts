import "server-only";
import { createTranslator } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, type AppLocale, type Namespace } from "@/i18n/config";
import { loadMessages } from "@/i18n/messages";
import { createFormat } from "@/lib/format";

/** The request's locale; "en" outside a request (worker, seed, scripts). */
export async function getAppLocale(): Promise<AppLocale> {
  try {
    const l = await getLocale();
    return isLocale(l) ? l : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Locale-bound formatters for server components and services. */
export async function getFormat() {
  return createFormat(await getAppLocale());
}

/** A translator for an explicit locale (emails and notifications use the recipient's language). */
export async function translatorFor<NS extends Namespace>(locale: AppLocale, namespace: NS) {
  return createTranslator({ locale, messages: await loadMessages(locale), namespace });
}

/**
 * Translator for services and actions: the request's locale inside a request, English otherwise
 * (so the worker and seed scripts keep working).
 */
export async function serverT<NS extends Namespace>(namespace: NS) {
  try {
    return (await getTranslations(namespace)) as unknown as Awaited<ReturnType<typeof translatorFor<NS>>>;
  } catch {
    return translatorFor(DEFAULT_LOCALE, namespace);
  }
}
