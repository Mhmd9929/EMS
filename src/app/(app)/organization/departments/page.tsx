import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { DEPARTMENT_SORTS, listDepartmentOptions, listDepartments, listDepartmentsTree } from "@/server/services/org.service";
import { listEmployeeOptions } from "@/server/services/employee.service";
import { first, parseListParams, type SearchParams } from "@/lib/list-params";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeader } from "@/components/data-table/sort-header";
import { Pagination } from "@/components/data-table/pagination";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/data-table/toolbar";
import { hrefWith } from "@/components/data-table/url";
import { EmptyState } from "@/components/empty-state";
import { DepartmentDialog } from "./department-dialog";
import { DepartmentTree } from "./department-tree";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "org.manage");
  const sp = await searchParams;
  const params = parseListParams(sp, { sortable: DEPARTMENT_SORTS, defaultSort: "name" });
  const activeParam = first(sp.active);
  const view = first(sp.view) === "tree" ? "tree" : "table";
  const [result, tree, parentOptions, employees] = await Promise.all([
    listDepartments(ctx, params, { active: activeParam === "yes" ? true : activeParam === "no" ? false : undefined }),
    view === "tree" ? listDepartmentsTree(ctx) : Promise.resolve([]),
    listDepartmentOptions(ctx),
    listEmployeeOptions(ctx),
  ]);
  const options = { parents: parentOptions, employees };
  const path = "/organization/departments";

  return (
    <>
      <PageHeader title="Departments" description="Hierarchical departments with heads and cost centres." actions={<DepartmentDialog options={options} />} />
      <div className="mb-4 flex gap-1 rounded-lg border p-0.5 text-sm w-fit" role="tablist" aria-label="View">
        {(["table", "tree"] as const).map((v) => (
          <Link key={v} role="tab" aria-selected={view === v} href={hrefWith(path, sp, { view: v === "table" ? undefined : v })} className={cn("rounded-md px-3 py-1 capitalize", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {v}
          </Link>
        ))}
      </div>
      {view === "tree" ? (
        tree.length ? <DepartmentTree tree={tree} options={options} /> : <EmptyState icon={Building2} title="No departments yet" />
      ) : (
        <>
          <Toolbar>
            <SearchInput placeholder="Search name or code…" />
            <FilterSelect param="active" label="Status" options={[{ value: "yes", label: "Active" }, { value: "no", label: "Inactive" }]} />
            <ClearFilters params={["q", "active"]} />
          </Toolbar>
          {result.items.length === 0 ? (
            <EmptyState icon={Building2} title={params.q ? "No departments match" : "No departments yet"} description="Create your first department to start building the org structure." />
          ) : (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader label="Name" sortKey="name" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                    <SortHeader label="Code" sortKey="code" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                    <TableHead className="hidden md:table-cell">Parent</TableHead>
                    <TableHead className="hidden md:table-cell">Head</TableHead>
                    <TableHead className="hidden lg:table-cell">Cost centre</TableHead>
                    <SortHeader label="People" sortKey="headcount" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                    <TableHead>Status</TableHead>
                    <TableHead className="text-end">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="font-mono text-xs">{d.code}</TableCell>
                      <TableCell className="hidden md:table-cell">{d.parent?.name ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">{d.head ? `${d.head.preferredName || d.head.firstName} ${d.head.lastName}` : "—"}</TableCell>
                      <TableCell className="hidden font-mono text-xs lg:table-cell">{d.costCenterCode ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">{d._count.employees}</TableCell>
                      <TableCell>{d.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                      <TableCell className="text-end">
                        <DepartmentDialog options={options} department={{ id: d.id, name: d.name, code: d.code, costCenterCode: d.costCenterCode, description: d.description, parentId: d.parentId, headId: d.headId, isActive: d.isActive }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
          <Pagination {...result} pathname={path} searchParams={sp} />
        </>
      )}
    </>
  );
}
