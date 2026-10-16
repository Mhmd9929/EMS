"use client";
import { useMemo } from "react";
import { useLocale } from "next-intl";
import { createFormat } from "@/lib/format";

/** Locale-bound formatters for client components (see src/lib/format.ts). */
export function useFormat() {
  const locale = useLocale();
  return useMemo(() => createFormat(locale), [locale]);
}
