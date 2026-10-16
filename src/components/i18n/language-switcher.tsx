"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Languages } from "lucide-react";
import { setLocaleAction } from "@/server/actions/locale.actions";
import { LOCALE_LABELS, type AppLocale } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Toggles between English and Arabic. The label is always shown in the target language. */
export function LanguageSwitcher({ className, variant = "ghost" }: { className?: string; variant?: "ghost" | "outline" }) {
  const locale = useLocale();
  const target: AppLocale = locale === "ar" ? "en" : "ar";
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      size="sm"
      lang={target}
      disabled={pending}
      className={cn("gap-1.5", className)}
      aria-label={target === "ar" ? "التبديل إلى العربية" : "Switch to English"}
      onClick={() =>
        start(async () => {
          await setLocaleAction(target);
          router.refresh();
        })
      }
    >
      <Languages aria-hidden />
      {LOCALE_LABELS[target]}
    </Button>
  );
}
