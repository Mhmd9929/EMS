import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("common");
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <FileQuestion className="text-muted-foreground size-12" aria-hidden />
      <h1 className="text-2xl font-semibold">{t("error.notFoundTitle")}</h1>
      <p className="text-muted-foreground max-w-md text-sm">{t("error.notFoundDescription")}</p>
      <Link href="/dashboard" className={buttonVariants()}>
        {t("error.backToDashboard")}
      </Link>
    </div>
  );
}
