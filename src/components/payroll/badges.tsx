import { Badge } from "@/components/ui/badge";
import { useLocale, useTranslations } from "next-intl";
import { formatMoneyIn } from "@/lib/format";
import { cn } from "@/lib/utils";

const RUN: Record<string, { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "outline" | "default" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  CALCULATED: { label: "Calculated", variant: "outline" },
  UNDER_REVIEW: { label: "Under review", variant: "warning" },
  APPROVED: { label: "Approved", variant: "default" },
  RELEASED: { label: "Released", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
};

export const RUN_STATUSES = Object.entries(RUN).map(([value, r]) => ({ value, label: r.label }));

/** Run status values for filters; label them with t("enums.runStatus.<value>"). */
export const RUN_STATUS_VALUES = Object.keys(RUN) as (keyof typeof RUN)[];

export function RunStatusBadge({ status }: { status: string }) {
  const t = useTranslations("enums.runStatus");
  const r = RUN[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={r.variant}>{status in RUN ? t(status as "DRAFT") : r.label}</Badge>;
}

export function Money({ minor, currency, className, showCode = false }: { minor: number | bigint; currency: string; className?: string; showCode?: boolean }) {
  const locale = useLocale();
  return (
    <span className={cn("tabular-nums", Number(minor) < 0 && "text-destructive", className)}>
      {formatMoneyIn(locale, minor, currency, { withCode: showCode })}
    </span>
  );
}

export const RUN_STEPS = ["DRAFT", "CALCULATED", "UNDER_REVIEW", "APPROVED", "RELEASED"] as const;

export function RunStepper({ status }: { status: string }) {
  const idx = RUN_STEPS.indexOf(status as (typeof RUN_STEPS)[number]);
  const t = useTranslations("enums.runStatus");
  const tp = useTranslations("payroll");
  return (
    <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label={tp("runProgress")}>
      {RUN_STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-1">
          <span
            aria-current={i === idx ? "step" : undefined}
            className={cn(
              "rounded-full border px-2.5 py-1",
              status === "CANCELLED" ? "text-muted-foreground" : i < idx ? "bg-accent border-primary text-link" : i === idx ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground",
            )}
          >
            {t(s)}
          </span>
          {i < RUN_STEPS.length - 1 && <span className="text-muted-foreground inline-block rtl:rotate-180" aria-hidden>→</span>}
        </li>
      ))}
    </ol>
  );
}
