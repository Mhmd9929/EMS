import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IMPORT_COLUMNS, MAX_IMPORT_ROWS } from "@/lib/import/employee-csv";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Import employees" };

export default async function ImportPage() {
  const ctx = await requireAuth();
  requirePermission(ctx, ["employee.import"]);
  return (
    <>
      <PageHeader
        title="Import employees"
        description={`Upload a CSV (max ${MAX_IMPORT_ROWS} rows). A dry run validates every row first; nothing is saved until you confirm, and the import is all-or-nothing.`}
        actions={
          <a href="/api/employees/import-template" className={buttonVariants({ variant: "outline" })}>
            <Download aria-hidden /> Download template
          </a>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ImportWizard />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Columns</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {IMPORT_COLUMNS.map((c) => (
                <li key={c.key}>
                  <code className="bg-muted rounded px-1 text-xs">{c.key}</code>
                  {c.required && <span className="text-destructive ms-1 text-xs">required</span>}
                  {"help" in c && c.help && <span className="text-muted-foreground block text-xs">{c.help}</span>}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-3 text-xs">Department, position and location are matched by their code (see the Organisation pages).</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
