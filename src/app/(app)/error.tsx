"use client";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <AlertTriangle className="text-destructive size-10" aria-hidden />
      <h1 className="text-xl font-semibold">{t("error.title")}</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        {t("error.description")}
        {error.digest && ` ${t("error.reference", { digest: error.digest })}`}
      </p>
      <Button onClick={reset}>{t("tryAgain")}</Button>
    </div>
  );
}
