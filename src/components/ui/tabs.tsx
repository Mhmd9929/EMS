import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/** URL-driven tabs: only the active tab's content is rendered (and authorised) on the server. */
export function LinkTabs({ tabs, active, baseHref }: { tabs: { key: string; label: string }[]; active: string; baseHref: string }) {
  const t = useTranslations("common");
  return (
    <nav aria-label={t("sections")} className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`${baseHref}?tab=${t.key}`}
          aria-current={t.key === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
            t.key === active ? "border-primary text-foreground font-semibold" : "text-muted-foreground hover:text-foreground border-transparent",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
