import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { auditFilterOptions, listAuditLogs } from "@/server/services/admin.service";
import { first, parseListParams, type SearchParams } from "@/lib/list-params";
import { formatDateTime } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeader } from "@/components/data-table/sort-header";
import { Pagination } from "@/components/data-table/pagination";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/data-table/toolbar";
import { DateRangeFilter } from "./date-range-filter";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Audit log" };

function Changes({ before, after }: { before: unknown; after: unknown }) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  if (!keys.length) return <span className="text-muted-foreground text-xs">—</span>;
  const show = (v: unknown) => (v === null || v === undefined ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v));
  return (
    <details className="text-xs">
      <summary className="text-primary cursor-pointer select-none">{keys.length} field{keys.length === 1 ? "" : "s"}</summary>
      <table className="mt-2 w-full">
        <tbody>
          {keys.map((k) => (
            <tr key={k} className="border-t align-top">
              <td className="py-1 pr-2 font-mono">{k}</td>
              <td className="text-destructive py-1 pr-2 break-all line-through decoration-1">{k in b ? show(b[k]) : ""}</td>
              <td className="text-success py-1 break-all">{k in a ? show(a[k]) : ""}</td>
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
  return (
    <>
      <PageHeader title="Audit log" description="Every change to sensitive data: who, what, when, before/after values and IP address." />
      <Toolbar>
        <SearchInput placeholder="Search summary, action or entity id…" />
        <FilterSelect param="actor" label="User" options={options.actors} />
        <FilterSelect param="entity" label="Entity" options={options.entityTypes.map((e) => ({ value: e, label: e }))} />
        <DateRangeFilter />
        <ClearFilters params={["q", "actor", "entity", "action", "from", "to", "entityId"]} />
      </Toolbar>
      {result.items.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit events match" />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label="When" sortKey="createdAt" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="hidden md:table-cell">Summary</TableHead>
                <TableHead>Changes</TableHead>
                <TableHead className="hidden lg:table-cell">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((a) => (
                <TableRow key={a.id} className="align-top">
                  <TableCell className="text-xs whitespace-nowrap">{formatDateTime(a.createdAt, ctx.timezone)}</TableCell>
                  <TableCell className="text-sm">{a.actor?.name ?? <span className="text-muted-foreground">System</span>}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {a.action}
                    </Badge>
                    <p className="text-muted-foreground mt-1 text-xs">{a.entityType}</p>
                  </TableCell>
                  <TableCell className="hidden max-w-sm text-sm md:table-cell">{a.summary ?? "—"}</TableCell>
                  <TableCell className="max-w-md">
                    <Changes before={a.before} after={a.after} />
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs lg:table-cell">{a.ip ?? "—"}</TableCell>
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
