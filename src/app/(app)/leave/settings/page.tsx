import type { Metadata } from "next";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { getLeaveSettings, listHolidays, listLeavePolicies, listLeaveTypes } from "@/server/services/leave/config.service";
import { listDepartmentOptions, listLocationOptions, listPositionOptions } from "@/server/services/org.service";
import { first, type SearchParams } from "@/lib/list-params";
import { todayInTimeZone, toDateInput } from "@/lib/dates";
import { getTranslations } from "next-intl/server";
import { getFormat } from "@/server/i18n";
import { PageHeader } from "@/components/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { LeaveTypeLabel } from "@/components/leave/leave-badges";
import { LeaveTypeDialog } from "./leave-type-dialog";
import { PolicyDialog } from "./policy-dialog";
import { CopyHolidaysButton, DeleteHolidayButton, HolidayDialog } from "./holiday-dialog";
import { LeaveSettingsForm } from "./settings-form";
import Link from "next/link";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("leave"))("meta.settings") };
}

export default async function LeaveSettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "leave.config.manage");
  const sp = await searchParams;
  const tab = (["types", "policies", "holidays", "general"] as const).find((t) => t === first(sp.tab)) ?? "types";
  const thisYear = todayInTimeZone(ctx.timezone).getUTCFullYear();
  const year = Number(first(sp.year)) || thisYear;
  const [t, tc, te, f] = await Promise.all([getTranslations("leave.settings"), getTranslations("common"), getTranslations("enums"), getFormat()]);
  const days = (count: number) => tc("days", { count });

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <LinkTabs
        baseHref="/leave/settings"
        active={tab}
        tabs={[
          { key: "types", label: t("tabs.types") },
          { key: "policies", label: t("tabs.policies") },
          { key: "holidays", label: t("tabs.holidays") },
          { key: "general", label: t("tabs.general") },
        ]}
      />
      <div className="mt-6">
        {tab === "types" && <TypesTab />}
        {tab === "policies" && <PoliciesTab />}
        {tab === "holidays" && <HolidaysTab year={year} thisYear={thisYear} />}
        {tab === "general" && <GeneralTab />}
      </div>
    </>
  );

  async function TypesTab() {
    const [types, tl] = await Promise.all([listLeaveTypes(ctx, { includeInactive: true }), getTranslations("leave")]);
    return (
      <>
        <div className="mb-4 flex justify-end">
          <LeaveTypeDialog />
        </div>
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tl("columns.leaveType")}</TableHead>
                <TableHead>{t("types.entitlement")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("types.accrual")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("types.carryForward")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("types.rules")}</TableHead>
                <TableHead>{t("types.approval")}</TableHead>
                <TableHead>
                  <span className="sr-only">{tc("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((lt) => (
                <TableRow key={lt.id} className={cn(!lt.isActive && "opacity-60")}>
                  <TableCell>
                    <LeaveTypeLabel name={lt.name} color={lt.color} className="font-medium" />
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline" className="font-mono">{lt.code}</Badge>
                      {!lt.isPaid && <Badge variant="secondary">{t("types.unpaid")}</Badge>}
                      {lt.isSystemDefault && <Badge variant="secondary">{t("types.uaeDefault")}</Badge>}
                      {!lt.isActive && <Badge variant="destructive">{t("types.inactive")}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{lt.accrualMethod === "NONE" ? "—" : days(lt.annualEntitlement)}</TableCell>
                  <TableCell className="hidden text-sm md:table-cell">
                    {te(`accrualMethod.${lt.accrualMethod}`)}
                    {lt.accrualStartAfterMonths > 0 && <span className="text-muted-foreground block text-xs">{t("types.afterMonths", { count: lt.accrualStartAfterMonths })}</span>}
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">
                    {lt.carryForwardMax > 0 ? (lt.carryForwardExpiryMonths ? t("types.carryForwardExpiry", { days: days(lt.carryForwardMax), months: lt.carryForwardExpiryMonths }) : days(lt.carryForwardMax)) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden max-w-64 text-xs lg:table-cell">
                    {[
                      lt.minNoticeDays ? t("types.rule.notice", { count: lt.minNoticeDays }) : null,
                      lt.maxConsecutiveDays ? t("types.rule.maxDays", { count: lt.maxConsecutiveDays }) : null,
                      lt.requiresAttachmentAfterDays !== null ? (lt.requiresAttachmentAfterDays === 0 ? t("types.rule.documentRequired") : t("types.rule.documentAbove", { count: lt.requiresAttachmentAfterDays })) : null,
                      lt.genderEligibility ? (lt.genderEligibility === "FEMALE" ? t("types.rule.femaleOnly") : t("types.rule.maleOnly")) : null,
                      lt.countWeekends ? t("types.rule.calendarDays") : null,
                      lt.allowNegativeBalance ? t("types.rule.negativeAllowed") : null,
                      !lt.allowHalfDay ? t("types.rule.noHalfDays") : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{lt.approvalChain.length ? lt.approvalChain.map((s) => (s === "HR" ? te("approvalRole.HR") : t("types.manager"))).join(f.locale === "ar" ? " ← " : " → ") : tl("apply.automatic")}</TableCell>
                  <TableCell className="text-end">
                    <LeaveTypeDialog type={lt} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </>
    );
  }

  async function PoliciesTab() {
    const [policies, types, departments, positions, tl] = await Promise.all([listLeavePolicies(ctx), listLeaveTypes(ctx, { includeInactive: true }), listDepartmentOptions(ctx), listPositionOptions(ctx), getTranslations("leave")]);
    const options = { types: types.map((lt) => ({ value: lt.id, label: lt.name })), departments, positions };
    return (
      <>
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">{t("policies.intro")}</p>
          <PolicyDialog options={options} />
        </div>
        {policies.length === 0 ? (
          <EmptyState title={t("policies.emptyTitle")} description={t("policies.emptyDescription")} />
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("policies.policy")}</TableHead>
                  <TableHead>{tl("columns.leaveType")}</TableHead>
                  <TableHead>{t("policies.appliesTo")}</TableHead>
                  <TableHead>{t("types.entitlement")}</TableHead>
                  <TableHead>
                    <span className="sr-only">{tc("actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((p) => (
                  <TableRow key={p.id} className={cn(!p.isActive && "opacity-60")}>
                    <TableCell className="font-medium">
                      {p.name} {!p.isActive && <Badge variant="secondary">{t("types.inactive")}</Badge>}
                    </TableCell>
                    <TableCell>
                      <LeaveTypeLabel name={p.leaveType.name} color={p.leaveType.color} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {[p.department?.name, p.position?.title, p.employmentType ? te(`employmentType.${p.employmentType}`) : null].filter(Boolean).join(" · ")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {!p.isEligible ? <Badge variant="destructive">{t("policies.notEligible")}</Badge> : p.annualEntitlement !== null ? t("policies.entitlementOverride", { days: days(p.annualEntitlement), base: String(p.leaveType.annualEntitlement) }) : t("policies.default")}
                    </TableCell>
                    <TableCell className="text-end">
                      <PolicyDialog options={options} policy={{ id: p.id, name: p.name, leaveTypeId: p.leaveTypeId, departmentId: p.departmentId, positionId: p.positionId, employmentType: p.employmentType, isEligible: p.isEligible, annualEntitlement: p.annualEntitlement, isActive: p.isActive }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </>
    );
  }

  async function HolidaysTab({ year, thisYear }: { year: number; thisYear: number }) {
    const [holidays, locations] = await Promise.all([listHolidays(ctx, year), listLocationOptions(ctx)]);
    return (
      <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav className="flex gap-1 rounded-lg border p-0.5 text-sm" aria-label={tc("year")}>
            {[thisYear - 1, thisYear, thisYear + 1].map((y) => (
              <Link key={y} href={`/leave/settings?tab=holidays&year=${y}`} aria-current={y === year ? "page" : undefined} className={cn("rounded-md px-3 py-1", y === year ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {y}
              </Link>
            ))}
          </nav>
          <div className="flex gap-2">
            {holidays.length === 0 && <CopyHolidaysButton fromYear={year - 1} toYear={year} />}
            <HolidayDialog locations={locations} defaultDate={`${year}-01-01`} />
          </div>
        </div>
        {holidays.length === 0 ? (
          <EmptyState title={t("holidays.emptyTitle", { year: String(year) })} description={t("holidays.emptyDescription")} />
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("date")}</TableHead>
                  <TableHead>{t("holidays.holiday")}</TableHead>
                  <TableHead>{t("holidays.appliesTo")}</TableHead>
                  <TableHead>
                    <span className="sr-only">{tc("actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">{f.date(h.date)}</TableCell>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell>{h.location?.name ?? t("holidays.allLocations")}</TableCell>
                    <TableCell className="text-end whitespace-nowrap">
                      <HolidayDialog locations={locations} holiday={{ id: h.id, name: h.name, date: toDateInput(h.date), locationId: h.locationId }} />
                      <DeleteHolidayButton id={h.id} name={h.name} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
        <p className="text-muted-foreground mt-3 text-xs">{t("holidays.lunarNote")}</p>
      </>
    );
  }

  async function GeneralTab() {
    const settings = await getLeaveSettings(ctx);
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">{t("general.approvalsTitle")}</CardTitle>
          <CardDescription>{t("general.approvalsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LeaveSettingsForm escalationDays={settings.leaveEscalationDays} />
        </CardContent>
      </Card>
    );
  }
}
