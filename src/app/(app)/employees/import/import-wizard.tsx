"use client";
import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileSpreadsheet, XCircle } from "lucide-react";
import { commitImportAction, previewImportAction } from "@/server/actions/employee.actions";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormError } from "@/components/forms/form-error";

export function ImportWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [sendInvites, setSendInvites] = useState(false);
  const [showValid, setShowValid] = useState(false);
  const [preview, runPreview, previewing] = useActionState(previewImportAction, null);
  const [commit, runCommit, committing] = useActionState(commitImportAction, null);
  useActionFeedback(commit);

  const fd = () => {
    const data = new FormData();
    if (file) data.set("file", file);
    if (sendInvites) data.set("sendInvites", "on");
    return data;
  };

  if (commit?.ok && commit.data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 className="text-success size-10" aria-hidden />
          <p className="text-lg font-semibold">Imported {commit.data.created} employees</p>
          {commit.data.invited > 0 && <p className="text-muted-foreground text-sm">{commit.data.invited} invitations sent.</p>}
          <Link href="/employees" className={buttonVariants()}>
            Go to employees
          </Link>
        </CardContent>
      </Card>
    );
  }

  const result = preview?.ok ? preview.data : null;
  const rows = result?.rows ?? [];
  const visible = showValid ? rows : rows.filter((r) => r.errors.length);
  const canCommit = !!result && result.errorCount === 0 && result.fileErrors.length === 0 && rows.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="csv">CSV file</Label>
            <input
              id="csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-muted-foreground file:bg-secondary file:text-foreground text-sm file:mr-2 file:rounded-md file:border-0 file:px-3 file:py-1.5"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!file || previewing} onClick={() => startTransition(() => runPreview(fd()))} variant="outline">
              <FileSpreadsheet aria-hidden /> {previewing ? "Validating…" : "Run dry run"}
            </Button>
          </div>
          <FormError state={preview} />
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="space-y-4">
            {result.fileErrors.map((e) => (
              <Alert key={e} variant="error">
                {e}
              </Alert>
            ))}
            {rows.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{result.total} rows</Badge>
                <Badge variant="success">{rows.length - result.errorCount} valid</Badge>
                <Badge variant={result.errorCount ? "destructive" : "secondary"}>{result.errorCount} with errors</Badge>
                <label className="ml-auto flex items-center gap-2">
                  <Checkbox checked={showValid} onChange={(e) => setShowValid(e.target.checked)} /> Show valid rows
                </label>
              </div>
            )}
            {visible.length > 0 && (
              <div className="max-h-[28rem] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((r) => (
                      <TableRow key={r.row}>
                        <TableCell className="tabular-nums">{r.row}</TableCell>
                        <TableCell>
                          <p className="font-medium">{r.name || "—"}</p>
                          <p className="text-muted-foreground text-xs">{r.email}</p>
                        </TableCell>
                        <TableCell>
                          {r.errors.length === 0 ? (
                            <span className="text-success inline-flex items-center gap-1 text-sm">
                              <CheckCircle2 className="size-4" aria-hidden /> Ready
                            </span>
                          ) : (
                            <ul className="text-destructive space-y-0.5 text-xs">
                              {r.errors.map((e) => (
                                <li key={e} className="flex gap-1">
                                  <XCircle className="mt-0.5 size-3 shrink-0" aria-hidden />
                                  {e}
                                </li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {rows.length > 0 && result.errorCount > 0 && <Alert variant="warning">Fix the errors in your file and run the dry run again. Nothing has been saved.</Alert>}
            {canCommit && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={sendInvites} onChange={(e) => setSendInvites(e.target.checked)} /> Email invitations to imported employees
                </label>
                <Button disabled={committing} onClick={() => startTransition(() => runCommit(fd()))}>
                  {committing ? "Importing…" : `Import ${rows.length} employees`}
                </Button>
              </div>
            )}
            <FormError state={commit} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
