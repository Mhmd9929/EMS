import type { Metadata } from "next";
import Link from "next/link";
import { HandCoins } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { leaversWithoutSettlement, listSettlements } from "@/server/services/payroll/settlement.service";
import { first, type SearchParams } from "@/lib/list-params";
import { getFormat } from "@/server/i18n";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterSelect, Toolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/payroll/badges";
import { ApproveSettlementButton } from "@/components/payroll/approve-settlement-button";
import { buttonVariants } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("payroll"))("meta.settlements") };
}

const STATUSES = ["DRAFT", "APPROVED", "CANCELLED"] as const;

export default async function SettlementsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "payroll.settlement.manage");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === first(sp.status));
  const [t, te, f] = await Promise.all([getTranslations("payroll.settlements"), getTranslations("enums.settlementStatus"), getFormat()]);
  const tr = await getTranslations("enums.terminationReason");
  const reasonLabel = (r: string) => (tr.has(r as never) ? tr(r as never) : r);
  const [settlements, pending] = await Promise.all([listSettlements(ctx, status), leaversWithoutSettlement(ctx)]);
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {pending.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t("leaversTitle")}</CardTitle>
            <CardDescription>{t("leaversDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {pending.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-medium">
                      {e.firstName} {e.lastName}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      (<span dir="ltr">{e.employeeNumber}</span>) · {t("lastDay", { date: f.date(e.lastWorkingDay) })}
                      {e.terminationReason && ` · ${reasonLabel(e.terminationReason)}`}
                    </span>
                  </span>
                  <Link href={`/employees/${e.id}?tab=payroll`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                    {t("prepare")}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Toolbar>
        <FilterSelect param="status" label={t("status")} options={STATUSES.map((value) => ({ value, label: te(value) }))} />
      </Toolbar>
      {settlements.length === 0 ? (
        <EmptyState icon={HandCoins} title={t("empty")} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("lastDayCol")}</TableHead>
                <TableHead className="hidden text-end lg:table-cell">{t("gratuity")}</TableHead>
                <TableHead className="hidden text-end lg:table-cell">{t("leaveEncashment")}</TableHead>
                <TableHead className="text-end">{t("total")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="sr-only">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/employees/${s.employee.id}?tab=payroll`} className="font-medium hover:underline">
                      {s.employee.firstName} {s.employee.lastName}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      <span dir="ltr">{s.employee.employeeNumber}</span> · {s.employee.department?.name ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{f.date(s.lastWorkingDay)}</TableCell>
                  <TableCell className="hidden text-end lg:table-cell">
                    <Money minor={s.gratuity} currency={ctx.currency} />
                  </TableCell>
                  <TableCell className="hidden text-end lg:table-cell">
                    <Money minor={s.leaveEncashment} currency={ctx.currency} />
                  </TableCell>
                  <TableCell className="text-end font-medium">
                    <Money minor={s.total} currency={ctx.currency} showCode />
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.status === "APPROVED" ? "success" : s.status === "DRAFT" ? "warning" : "secondary"}>{te(s.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    {s.status === "DRAFT" && s.createdById !== ctx.userId && (
                      <ApproveSettlementButton settlementId={s.id} employeeId={s.employee.id} name={`${s.employee.firstName} ${s.employee.lastName}`} total={f.money(s.total, ctx.currency, { withCode: true })} />
                    )}
                    {s.status === "DRAFT" && s.createdById === ctx.userId && <span className="text-muted-foreground text-xs">{t("awaitingApprover")}</span>}
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
