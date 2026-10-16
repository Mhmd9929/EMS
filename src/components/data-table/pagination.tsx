import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { SearchParams } from "@/lib/list-params";
import { hrefWith } from "./url";
import { cn } from "@/lib/utils";
import { PageSizeSelect } from "./toolbar";
import { useTranslations } from "next-intl";

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  pathname,
  searchParams,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  pathname: string;
  searchParams: SearchParams;
}) {
  const t = useTranslations("common.pagination");
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = (p: number, disabled: boolean, label: string, Icon: typeof ChevronLeft) =>
    disabled ? (
      <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")} aria-disabled>
        <Icon className="rtl:-scale-x-100" aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
    ) : (
      <Link href={hrefWith(pathname, searchParams, { page: p })} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label={label}>
        <Icon className="rtl:-scale-x-100" aria-hidden />
      </Link>
    );
  return (
    <div className="flex flex-col items-center justify-between gap-3 pt-4 text-sm sm:flex-row">
      <p className="text-muted-foreground">
        {total === 0 ? t("noResults") : t("showing", { from, to, total })}
      </p>
      <div className="flex items-center gap-2">
        <PageSizeSelect value={pageSize} />
        <span className="text-muted-foreground px-1">
          {t("page", { page, pages: pageCount })}
        </span>
        {link(page - 1, page <= 1, t("previous"), ChevronLeft)}
        {link(page + 1, page >= pageCount, t("next"), ChevronRight)}
      </div>
    </div>
  );
}
