import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireAuth } from "@/server/auth/context";
import { leaveCalendar, type CalendarScope } from "@/server/services/leave/calendar.service";
import { listDepartmentOptions } from "@/server/services/org.service";
import { first, type SearchParams } from "@/lib/list-params";
import { todayInTimeZone, toDateInput } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { FilterSelect, Toolbar } from "@/components/data-table/toolbar";
import { hrefWith } from "@/components/data-table/url";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { CalendarGrid } from "./calendar-grid";
import { getTranslations } from "next-intl/server";
import { getFormat } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("leave"))("meta.calendar") };
}

export default async function LeaveCalendarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  const sp = await searchParams;
  const today = todayInTimeZone(ctx.timezone);
  const monthParam = first(sp.month); // YYYY-MM
  const [y, m] = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam.split("-").map(Number) : [today.getUTCFullYear(), today.getUTCMonth() + 1];
  const [t, tc, f] = await Promise.all([getTranslations("leave.calendar"), getTranslations("common"), getFormat()]);
  const scopes: { value: CalendarScope; label: string }[] = [
    ...(ctx.employeeId ? [{ value: "mine" as const, label: t("scope.mine") }] : []),
    ...(ctx.employeeId && (ctx.permissions.has("leave.approve.team") || ctx.permissions.has("leave.request.read.all")) ? [{ value: "team" as const, label: t("scope.team") }] : []),
    ...(ctx.permissions.has("leave.request.read.all") ? [{ value: "company" as const, label: t("scope.company") }] : []),
  ];
  const requested = first(sp.scope) as CalendarScope | undefined;
  const scope = scopes.find((s) => s.value === requested)?.value ?? (scopes.find((s) => s.value === "team") ?? scopes.find((s) => s.value === "company") ?? scopes[0])?.value;
  if (!scope) return <EmptyState title={t("noCalendarTitle")} description={t("noCalendarDescription")} />;
  const departmentId = scope === "company" ? first(sp.department) : undefined;
  const [data, departments] = await Promise.all([leaveCalendar(ctx, { year: y, month: m - 1, scope, departmentId }), scope === "company" ? listDepartmentOptions(ctx) : []]);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const next = new Date(Date.UTC(y, m, 1));
  const ym = (d: Date) => toDateInput(d).slice(0, 7);
  const path = "/leave/calendar";
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link href={hrefWith(path, sp, { month: ym(prev) })} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label={t("previousMonth")}>
            <ChevronLeft className="rtl:-scale-x-100" aria-hidden />
          </Link>
          <h2 className="w-44 text-center text-lg font-semibold">
            {f.month(new Date(Date.UTC(y, m - 1, 1)))}
          </h2>
          <Link href={hrefWith(path, sp, { month: ym(next) })} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label={t("nextMonth")}>
            <ChevronRight className="rtl:-scale-x-100" aria-hidden />
          </Link>
          <Link href={hrefWith(path, sp, { month: undefined })} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {t("today")}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scopes.length > 1 && (
            <nav className="flex gap-1 rounded-lg border p-0.5 text-sm" aria-label={t("scopeNav")}>
              {scopes.map((s) => (
                <Link key={s.value} href={hrefWith(path, sp, { scope: s.value, department: undefined })} aria-current={scope === s.value ? "page" : undefined} className={cn("rounded-md px-3 py-1", scope === s.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {s.label}
                </Link>
              ))}
            </nav>
          )}
          {scope === "company" && (
            <Toolbar>
              <FilterSelect param="department" label={tc("department")} options={departments} />
            </Toolbar>
          )}
        </div>
      </div>
      {data.rows.length === 0 ? (
        <EmptyState title={t("emptyRows")} />
      ) : (
        <CalendarGrid
          year={y}
          month={m - 1}
          today={toDateInput(today)}
          workWeek={data.workWeek}
          holidays={data.holidays}
          rows={data.rows}
          linkable={scope !== "mine"}
        />
      )}
    </>
  );
}
