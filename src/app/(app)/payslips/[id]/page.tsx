import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { requireAuth } from "@/server/auth/context";
import { getPayslip } from "@/server/services/payroll/payslip.service";
import { amountInWords, amountInWordsAr } from "@/lib/payroll/words";
import { lineNoteText } from "@/lib/payroll/issues";
import { getFormat } from "@/server/i18n";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Money } from "@/components/payroll/badges";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("payslips"))("meta.view") };
}

export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  const { id } = await params;
  // getPayslip throws NotFound for anything the user may not see (another employee's, unreleased, voided).
  const p = await getPayslip(ctx, id).catch(() => notFound());
  const cur = p.currency;
  const [t, tp, f] = await Promise.all([getTranslations("payslips.view"), getTranslations("payroll"), getFormat()]);
  const own = p.employee.id === ctx.employeeId;
  const facts: [string, React.ReactNode][] = [
    [t("facts.employeeNo"), <span key="no" dir="ltr">{p.employee.number}</span>],
    [t("facts.department"), p.employee.department ?? "—"],
    [t("facts.position"), p.employee.position ?? "—"],
    [t("facts.joined"), f.date(p.employee.joinDate)],
    [t("facts.payPeriod"), `${f.date(p.periodStart)} – ${f.date(p.periodEnd)}`],
    [t("facts.paidDays"), p.unpaidLeaveDays ? t("paidDaysUnpaid", { paid: p.paidDays, unpaid: p.unpaidLeaveDays }) : String(p.paidDays)],
    [t("facts.bank"), p.employee.bankName ?? "—"],
    [t("facts.iban"), p.employee.ibanMasked ? <span key="iban" dir="ltr">{p.employee.ibanMasked}</span> : "—"],
  ];
  const Lines = ({ title, totalLabel, lines, total }: { title: string; totalLabel: string; lines: { name: string; amount: number; note: string | null }[]; total: number }) => (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y text-sm">
          {lines.length === 0 && <li className="text-muted-foreground px-6 py-2">{t("none")}</li>}
          {lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-4 px-6 py-2">
              <span>
                {l.name}
                {l.note && <span className="text-muted-foreground block text-xs">{lineNoteText(l.note, tp)}</span>}
              </span>
              <Money minor={l.amount} currency={cur} />
            </li>
          ))}
          <li className="bg-muted/50 flex justify-between px-6 py-2 font-medium">
            <span>{totalLabel}</span>
            <Money minor={total} currency={cur} />
          </li>
        </ul>
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">
            <Link href={own ? "/payslips" : `/employees/${p.employee.id}?tab=payroll`} className="hover:underline">
              {own ? t("myPayslips") : p.employee.name}
            </Link>{" "}
            / <span dir="ltr">{p.number}</span>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{t("heading", { month: f.month(p.period) })}</h1>
          <p className="text-muted-foreground text-sm">
            {t("subtitle", { name: p.employee.name, company: p.company.legalName ?? p.company.name, date: f.date(p.releasedAt) })}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/payslips/${p.id}/pdf`} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline" })}>
            <ExternalLink aria-hidden /> {t("openPdf")}
          </a>
          <a href={`/api/payslips/${p.id}/pdf?download=1`} className={buttonVariants()}>
            <Download aria-hidden /> {t("downloadPdf")}
          </a>
        </div>
      </div>

      <Card>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground text-xs">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Lines title={t("earnings")} totalLabel={t("totalEarnings")} lines={p.earnings} total={p.gross} />
        <Lines title={t("deductions")} totalLabel={t("totalDeductions")} lines={p.deductions} total={p.totalDeductions} />
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-muted-foreground text-sm">{t("netPay")}</p>
            <p className="text-muted-foreground text-xs">{f.locale === "ar" ? amountInWordsAr(p.net, cur) : amountInWords(p.net, cur)}</p>
          </div>
          <p className="text-link text-2xl font-semibold">
            <Money minor={p.net} currency={cur} showCode />
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("ytd", { month: f.month(p.ytd.from) })}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            {(
              [
                [t("gross"), p.ytd.gross],
                [t("deductions"), p.ytd.deductions],
                [t("net"), p.ytd.net],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground text-xs">{k}</dt>
                <dd className="font-medium">
                  <Money minor={v} currency={cur} />
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
