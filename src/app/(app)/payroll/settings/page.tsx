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

export const metadata: Metadata = { title: "Payroll settings" };

export default async function PayrollSettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "payroll.settings.manage");
  const tab = first((await searchParams).tab) === "general" ? "general" : "components";
  return (
    <>
      <PageHeader title="Payroll settings" description="Pay components, proration, WPS and end-of-service rules. UAE defaults are pre-loaded and editable." />
      <LinkTabs
        baseHref="/payroll/settings"
        active={tab}
        tabs={[
          { key: "components", label: "Pay components" },
          { key: "general", label: "General, WPS & end of service" },
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
          <p className="text-muted-foreground font-mono text-xs">{c.code}</p>
        </TableCell>
        <TableCell className="text-sm">{c.calcType === "FORMULA" ? <code className="bg-muted rounded px-1.5 py-0.5 text-xs">{c.formula}</code> : "Fixed amount"}</TableCell>
        <TableCell className="hidden md:table-cell">
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">{c.isRecurring ? "Monthly" : "One-time"}</Badge>
            {c.kind === "EARNING" && <Badge variant="outline">{c.isFixedPay ? "WPS fixed" : "WPS variable"}</Badge>}
            {c.isTaxable && <Badge variant="outline">Taxable</Badge>}
            {c.isSystem && <Badge variant="outline">System</Badge>}
            {!c.isActive && <Badge variant="secondary">Inactive</Badge>}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <ComponentDialog component={{ id: c.id, code: c.code, name: c.name, kind: c.kind, calcType: c.calcType, formula: c.formula, isRecurring: c.isRecurring, isTaxable: c.isTaxable, isFixedPay: c.isFixedPay, isActive: c.isActive, isSystem: c.isSystem }} codes={codes} />
        </TableCell>
      </TableRow>
    );
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground max-w-2xl text-sm">
            Monthly components make up an employee&apos;s salary structure; one-time components are used for monthly adjustments. Formulas can use other components, e.g.{" "}
            <code className="bg-muted rounded px-1">BASIC * 0.5</code> or <code className="bg-muted rounded px-1">min(BASIC * 0.1, 2000)</code>.
          </p>
          <ComponentDialog codes={codes} />
        </div>
        {(["EARNING", "DEDUCTION"] as const).map((kind) => (
          <Card key={kind} className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{kind === "EARNING" ? "Earnings" : "Deductions"}</TableHead>
                  <TableHead>Calculation</TableHead>
                  <TableHead className="hidden md:table-cell">Flags</TableHead>
                  <TableHead className="sr-only">Actions</TableHead>
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
