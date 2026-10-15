import type { Metadata } from "next";
import { Briefcase } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { POSITION_SORTS, listPositions } from "@/server/services/org.service";
import { first, parseListParams, type SearchParams } from "@/lib/list-params";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeader } from "@/components/data-table/sort-header";
import { Pagination } from "@/components/data-table/pagination";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/empty-state";
import { PositionDialog } from "./position-dialog";

export const metadata: Metadata = { title: "Positions" };

export default async function PositionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "org.manage");
  const sp = await searchParams;
  const params = parseListParams(sp, { sortable: POSITION_SORTS, defaultSort: "title" });
  const active = first(sp.active);
  const result = await listPositions(ctx, params, { active: active === "yes" ? true : active === "no" ? false : undefined });
  const path = "/organization/positions";
  const sort = (label: string, key: (typeof POSITION_SORTS)[number], className?: string) => (
    <SortHeader label={label} sortKey={key} current={params.sort} dir={params.dir} pathname={path} searchParams={sp} className={className} />
  );
  return (
    <>
      <PageHeader title="Positions" description="Job titles with grade and level." actions={<PositionDialog />} />
      <Toolbar>
        <SearchInput placeholder="Search title, code, grade…" />
        <FilterSelect param="active" label="Status" options={[{ value: "yes", label: "Active" }, { value: "no", label: "Inactive" }]} />
        <ClearFilters params={["q", "active"]} />
      </Toolbar>
      {result.items.length === 0 ? (
        <EmptyState icon={Briefcase} title={params.q ? "No positions match" : "No positions yet"} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                {sort("Title", "title")}
                {sort("Code", "code")}
                {sort("Grade", "grade", "hidden sm:table-cell")}
                {sort("Level", "level", "hidden sm:table-cell")}
                <TableHead>People</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-end">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="font-mono text-xs">{p.code}</TableCell>
                  <TableCell className="hidden sm:table-cell">{p.grade ?? "—"}</TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">{p.level ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{p._count.employees}</TableCell>
                  <TableCell>{p.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                  <TableCell className="text-end">
                    <PositionDialog position={{ id: p.id, title: p.title, code: p.code, grade: p.grade, level: p.level, description: p.description, isActive: p.isActive }} />
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
