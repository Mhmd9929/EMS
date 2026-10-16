import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Messages } from "@/i18n/messages";
import { ScrollText } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { auditFilterOptions, listAuditLogs } from "@/server/services/admin.service";
import { first, parseListParams, type SearchParams } from "@/lib/list-params";
import { getFormat } from "@/server/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeader } from "@/components/data-table/sort-header";
import { Pagination } from "@/components/data-table/pagination";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/data-table/toolbar";
import { DateRangeFilter } from "./date-range-filter";
import { EmptyState } from "@/components/empty-state";

type AuditMessages = Messages["admin"]["audit"];

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin"))("audit.title") };
}

function Changes({ before, after, fieldsLabel }: { before: unknown; after: unknown; fieldsLabel: (count: number) => string }) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  if (!keys.length) return <span className="text-muted-foreground text-xs">—</span>;
  const show = (v: unknown) => (v === null || v === undefined ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v));
  return (
    <details className="text-xs">
      <summary className="text-link cursor-pointer select-none">{fieldsLabel(keys.length)}</summary>
      <table className="mt-2 w-full">
        <tbody>
          {keys.map((k) => (
            <tr key={k} className="border-t align-top">
              <td className="py-1 pe-2 font-mono" dir="ltr">
                {k}
              </td>
              <td className="text-destructive py-1 pe-2 break-all line-through decoration-1" dir="ltr">{k in b ? show(b[k]) : ""}</td>
              <td className="text-success py-1 break-all" dir="ltr">{k in a ? show(a[k]) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "audit.read");
  const sp = await searchParams;
  const params = parseListParams(sp, { sortable: ["createdAt"] as const, defaultSort: "createdAt", defaultDir: "desc", defaultPageSize: 50 });
  const [result, options] = await Promise.all([
    listAuditLogs(ctx, params, {
      actorUserId: first(sp.actor),
      entityType: first(sp.entity),
      entityId: first(sp.entityId),
      action: first(sp.action),
      from: first(sp.from),
      to: first(sp.to),
    }),
    auditFilterOptions(ctx),
  ]);
  const path = "/admin/audit";
  const t = await getTranslations("admin.audit");
  const f = await getFormat();
  // Entity types and action keys are codes; show a translated label when one exists.
  const entityLabel = (e: string) => {
    const key = `entityTypes.${e}` as `entityTypes.${keyof AuditMessages["entityTypes"]}`;
    return t.has(key) ? t(key) : e;
  };
  const actionLabel = (a: string) => {
    const key = `actions.${a.replaceAll(".", "_")}` as `actions.${keyof AuditMessages["actions"]}`;
    return t.has(key) ? t(key) : undefined;
  };
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Toolbar>
        <SearchInput placeholder={t("search")} />
        <FilterSelect param="actor" label={t("user")} options={options.actors} />
        <FilterSelect param="entity" label={t("entity")} options={options.entityTypes.map((e) => ({ value: e, label: entityLabel(e) }))} />
        <DateRangeFilter />
        <ClearFilters params={["q", "actor", "entity", "action", "from", "to", "entityId"]} />
      </Toolbar>
      {result.items.length === 0 ? (
        <EmptyState icon={ScrollText} title={t("empty")} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label={t("columns.when")} sortKey="createdAt" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                <TableHead>{t("columns.user")}</TableHead>
                <TableHead>{t("columns.action")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("columns.summary")}</TableHead>
                <TableHead>{t("columns.changes")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("columns.ip")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((a) => (
                <TableRow key={a.id} className="align-top">
                  <TableCell className="text-xs whitespace-nowrap">{f.dateTime(a.createdAt, ctx.timezone)}</TableCell>
                  <TableCell className="text-sm">{a.actor?.name ?? <span className="text-muted-foreground">{t("system")}</span>}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono" dir="ltr" title={actionLabel(a.action)}>
                      {a.action}
                    </Badge>
                    <p className="text-muted-foreground mt-1 text-xs">{entityLabel(a.entityType)}</p>
                  </TableCell>
                  <TableCell className="hidden max-w-sm text-sm md:table-cell">{a.summary ?? "—"}</TableCell>
                  <TableCell className="max-w-md">
                    <Changes before={a.before} after={a.after} fieldsLabel={(count) => t("fields", { count })} />
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs lg:table-cell">
                    <span dir="ltr">{a.ip ?? "—"}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <Pagination {...result} pathname={path} searchParams={sp} />
    </>
  );
}
