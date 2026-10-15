import type { Metadata } from "next";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { getLeaveSettings, listHolidays, listLeavePolicies, listLeaveTypes } from "@/server/services/leave/config.service";
import { listDepartmentOptions, listLocationOptions, listPositionOptions } from "@/server/services/org.service";
import { first, type SearchParams } from "@/lib/list-params";
import { formatDate, todayInTimeZone, toDateInput } from "@/lib/dates";
import { EMPLOYMENT_TYPES, labelOf } from "@/lib/constants";
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

export const metadata: Metadata = { title: "Leave settings" };

const ACCRUAL = { UPFRONT: "Yearly, up front", MONTHLY: "Monthly accrual", NONE: "No balance" } as const;

export default async function LeaveSettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "leave.config.manage");
  const sp = await searchParams;
  const tab = (["types", "policies", "holidays", "general"] as const).find((t) => t === first(sp.tab)) ?? "types";
  const thisYear = todayInTimeZone(ctx.timezone).getUTCFullYear();
  const year = Number(first(sp.year)) || thisYear;

  return (
    <>
      <PageHeader title="Leave settings" description="UAE defaults are pre-loaded as editable starting points — nothing is hard-coded." />
      <LinkTabs
        baseHref="/leave/settings"
        active={tab}
        tabs={[
          { key: "types", label: "Leave types" },
          { key: "policies", label: "Policies" },
          { key: "holidays", label: "Public holidays" },
          { key: "general", label: "General" },
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
    const types = await listLeaveTypes(ctx, { includeInactive: true });
    return (
      <>
        <div className="mb-4 flex justify-end">
          <LeaveTypeDialog />
        </div>
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leave type</TableHead>
                <TableHead>Entitlement</TableHead>
                <TableHead className="hidden md:table-cell">Accrual</TableHead>
                <TableHead className="hidden lg:table-cell">Carry forward</TableHead>
                <TableHead className="hidden lg:table-cell">Rules</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((t) => (
                <TableRow key={t.id} className={cn(!t.isActive && "opacity-60")}>
                  <TableCell>
                    <LeaveTypeLabel name={t.name} color={t.color} className="font-medium" />
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline" className="font-mono">{t.code}</Badge>
                      {!t.isPaid && <Badge variant="secondary">Unpaid</Badge>}
                      {t.isSystemDefault && <Badge variant="secondary">UAE default</Badge>}
                      {!t.isActive && <Badge variant="destructive">Inactive</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{t.accrualMethod === "NONE" ? "—" : `${t.annualEntitlement} days`}</TableCell>
                  <TableCell className="hidden text-sm md:table-cell">
                    {ACCRUAL[t.accrualMethod]}
                    {t.accrualStartAfterMonths > 0 && <span className="text-muted-foreground block text-xs">after {t.accrualStartAfterMonths} months</span>}
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">
                    {t.carryForwardMax > 0 ? `${t.carryForwardMax} days${t.carryForwardExpiryMonths ? `, expires after ${t.carryForwardExpiryMonths} mo` : ""}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden max-w-64 text-xs lg:table-cell">
                    {[
                      t.minNoticeDays ? `${t.minNoticeDays}d notice` : null,
                      t.maxConsecutiveDays ? `max ${t.maxConsecutiveDays}d` : null,
                      t.requiresAttachmentAfterDays !== null ? (t.requiresAttachmentAfterDays === 0 ? "document required" : `document > ${t.requiresAttachmentAfterDays}d`) : null,
                      t.genderEligibility ? `${t.genderEligibility.toLowerCase()} only` : null,
                      t.countWeekends ? "calendar days" : null,
                      t.allowNegativeBalance ? "negative allowed" : null,
                      !t.allowHalfDay ? "no half days" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{t.approvalChain.length ? t.approvalChain.map((s) => (s === "HR" ? "HR" : "Manager")).join(" → ") : "Automatic"}</TableCell>
                  <TableCell className="text-end">
                    <LeaveTypeDialog type={t} />
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
    const [policies, types, departments, positions] = await Promise.all([listLeavePolicies(ctx), listLeaveTypes(ctx, { includeInactive: true }), listDepartmentOptions(ctx), listPositionOptions(ctx)]);
    const options = { types: types.map((t) => ({ value: t.id, label: t.name })), departments, positions };
    return (
      <>
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">Override the entitlement or eligibility for a group. When several match, the most specific wins (position › department › employment type).</p>
          <PolicyDialog options={options} />
        </div>
        {policies.length === 0 ? (
          <EmptyState title="No policies" description="Everyone gets the leave type defaults." />
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy</TableHead>
                  <TableHead>Leave type</TableHead>
                  <TableHead>Applies to</TableHead>
                  <TableHead>Entitlement</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((p) => (
                  <TableRow key={p.id} className={cn(!p.isActive && "opacity-60")}>
                    <TableCell className="font-medium">
                      {p.name} {!p.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </TableCell>
                    <TableCell>
                      <LeaveTypeLabel name={p.leaveType.name} color={p.leaveType.color} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {[p.department?.name, p.position?.title, p.employmentType ? labelOf(EMPLOYMENT_TYPES, p.employmentType) : null].filter(Boolean).join(" · ")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {!p.isEligible ? <Badge variant="destructive">Not eligible</Badge> : p.annualEntitlement !== null ? `${p.annualEntitlement} days (default ${p.leaveType.annualEntitlement})` : "Default"}
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
          <nav className="flex gap-1 rounded-lg border p-0.5 text-sm" aria-label="Year">
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
          <EmptyState title={`No public holidays for ${year}`} description="Add them one by one or copy last year's and adjust the lunar dates." />
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Holiday</TableHead>
                  <TableHead>Applies to</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatDate(h.date)}</TableCell>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell>{h.location?.name ?? "All locations"}</TableCell>
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
        <p className="text-muted-foreground mt-3 text-xs">Islamic holidays depend on moon sighting — update the dates once they are officially announced. Existing requests keep their calculated days.</p>
      </>
    );
  }

  async function GeneralTab() {
    const settings = await getLeaveSettings(ctx);
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Approvals</CardTitle>
          <CardDescription>The work week used for counting leave days is set in Company settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <LeaveSettingsForm escalationDays={settings.leaveEscalationDays} />
        </CardContent>
      </Card>
    );
  }
}
