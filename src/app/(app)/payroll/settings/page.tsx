import type { Metadata } from "next";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { getPayrollSettings, listPayComponents } from "@/server/services/payroll/settings.service";
import { first, type SearchParams } from "@/lib/list-params";
import { PageHeader } from "@/components/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ComponentDialog } from "./component-dialog";
import { PayrollSettingsForm } from "./settings-form";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("payroll"))("meta.settings") };
}

export default async function PayrollSettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "payroll.settings.manage");
  const tab = first((await searchParams).tab) === "general" ? "general" : "components";
  const t = await getTranslations("payroll.settings");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <LinkTabs
        baseHref="/payroll/settings"
        active={tab}
        tabs={[
          { key: "components", label: t("tabComponents") },
          { key: "general", label: t("tabGeneral") },
        ]}
      />
      <div className="mt-6">{tab === "components" ? <ComponentsTab /> : <GeneralTab />}</div>
    </>
  );

  async function ComponentsTab() {
    const components = await listPayComponents(ctx);
    const codes = components.map((c) => c.code);
    const row = (c: (typeof components)[number]) => (
      <TableRow key={c.id} className={c.isActive ? undefined : "opacity-60"}>
        <TableCell>
          <p className="font-medium">{c.name}</p>
          <p className="text-muted-foreground font-mono text-xs" dir="ltr">{c.code}</p>
        </TableCell>
        <TableCell className="text-sm">{c.calcType === "FORMULA" ? <code className="bg-muted rounded px-1.5 py-0.5 text-xs" dir="ltr">{c.formula}</code> : t("fixedAmount")}</TableCell>
        <TableCell className="hidden md:table-cell">
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">{c.isRecurring ? t("monthly") : t("oneTime")}</Badge>
            {c.kind === "EARNING" && <Badge variant="outline">{c.isFixedPay ? t("wpsFixed") : t("wpsVariable")}</Badge>}
            {c.isTaxable && <Badge variant="outline">{t("taxable")}</Badge>}
            {c.isSystem && <Badge variant="outline">{t("system")}</Badge>}
            {!c.isActive && <Badge variant="secondary">{t("inactive")}</Badge>}
          </div>
        </TableCell>
        <TableCell className="text-end">
          <ComponentDialog component={{ id: c.id, code: c.code, name: c.name, kind: c.kind, calcType: c.calcType, formula: c.formula, isRecurring: c.isRecurring, isTaxable: c.isTaxable, isFixedPay: c.isFixedPay, isActive: c.isActive, isSystem: c.isSystem }} codes={codes} />
        </TableCell>
      </TableRow>
    );
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground max-w-2xl text-sm">
            {t.rich("componentsIntro", {
              example1: "BASIC * 0.5",
              example2: "min(BASIC * 0.1, 2000)",
              code: (chunks) => (
                <code className="bg-muted rounded px-1" dir="ltr">
                  {chunks}
                </code>
              ),
            })}
          </p>
          <ComponentDialog codes={codes} />
        </div>
        {(["EARNING", "DEDUCTION"] as const).map((kind) => (
          <Card key={kind} className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{kind === "EARNING" ? t("earnings") : t("deductions")}</TableHead>
                  <TableHead>{t("calculation")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("flags")}</TableHead>
                  <TableHead className="sr-only">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{components.filter((c) => c.kind === kind).map(row)}</TableBody>
            </Table>
          </Card>
        ))}
      </div>
    );
  }

  async function GeneralTab() {
    const s = await getPayrollSettings(ctx);
    return (
      <PayrollSettingsForm
        settings={{
          currency: s.currency,
          payrollProrationBasis: s.payrollProrationBasis,
          wpsEmployerId: s.wpsEmployerId ?? "",
          wpsEmployerBankCode: s.wpsEmployerBankCode ?? "",
          wpsFormat: s.wpsFormat,
          gratuityMinServiceYears: Number(s.gratuityMinServiceYears),
          gratuityDaysFirstYears: Number(s.gratuityDaysFirstYears),
          gratuityThresholdYears: Number(s.gratuityThresholdYears),
          gratuityDaysAfter: Number(s.gratuityDaysAfter),
          gratuityCapMonths: Number(s.gratuityCapMonths),
          gratuityDailyBasis: s.gratuityDailyBasis,
          leaveEncashmentBasis: s.leaveEncashmentBasis,
          payslipPdfPassword: s.payslipPdfPassword,
        }}
      />
    );
  }
}
