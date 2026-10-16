import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IMPORT_COLUMNS, MAX_IMPORT_ROWS } from "@/lib/import/employee-csv";
import { ImportWizard } from "./import-wizard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("employees"))("meta.import") };
}

const HELP_KEYS = ["employeeNumber", "dateOfBirth", "gender", "joinDate", "employmentType", "managerEmail"] as const;
type HelpKey = (typeof HELP_KEYS)[number];
const hasHelp = (key: string): key is HelpKey => (HELP_KEYS as readonly string[]).includes(key);

export default async function ImportPage() {
  const ctx = await requireAuth();
  requirePermission(ctx, ["employee.import"]);
  const t = await getTranslations("employees.import");
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description", { max: MAX_IMPORT_ROWS })}
        actions={
          <a href="/api/employees/import-template" className={buttonVariants({ variant: "outline" })}>
            <Download aria-hidden /> {t("downloadTemplate")}
          </a>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ImportWizard />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("columns")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {IMPORT_COLUMNS.map((c) => (
                <li key={c.key}>
                  <code className="bg-muted rounded px-1 text-xs">{c.key}</code>
                  {c.required && <span className="text-destructive ms-1 text-xs">{t("required")}</span>}
                  {hasHelp(c.key) && <span className="text-muted-foreground block text-xs">{t(`columnHelp.${c.key}`)}</span>}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-3 text-xs">{t("codesHint")}</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
