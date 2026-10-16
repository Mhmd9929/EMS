import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("organization"))("departments.title") };
}

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
  const t = await getTranslations("organization");
  const tc = await getTranslations("common");
  const statusOptions = [{ value: "yes", label: t("active") }, { value: "no", label: t("inactive") }];

  return (
    <>
      <PageHeader title={t("departments.title")} description={t("departments.description")} actions={<DepartmentDialog options={options} />} />
      <div className="mb-4 flex gap-1 rounded-lg border p-0.5 text-sm w-fit" role="tablist" aria-label={t("departments.viewLabel")}>
        {(["table", "tree"] as const).map((v) => (
          <Link key={v} role="tab" aria-selected={view === v} href={hrefWith(path, sp, { view: v === "table" ? undefined : v })} className={cn("rounded-md px-3 py-1 capitalize", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {t(`departments.views.${v}`)}
          </Link>
        ))}
      </div>
      {view === "tree" ? (
        tree.length ? <DepartmentTree tree={tree} options={options} /> : <EmptyState icon={Building2} title={t("departments.empty")} />
      ) : (
        <>
          <Toolbar>
            <SearchInput placeholder={t("departments.search")} />
            <FilterSelect param="active" label={tc("status")} options={statusOptions} />
            <ClearFilters params={["q", "active"]} />
          </Toolbar>
          {result.items.length === 0 ? (
            <EmptyState icon={Building2} title={params.q ? t("departments.noMatch") : t("departments.empty")} description={t("departments.emptyDescription")} />
          ) : (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader label={tc("name")} sortKey="name" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                    <SortHeader label={t("code")} sortKey="code" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                    <TableHead className="hidden md:table-cell">{t("departments.columns.parent")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("departments.columns.head")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("departments.columns.costCentre")}</TableHead>
                    <SortHeader label={t("people")} sortKey="headcount" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                    <TableHead>{tc("status")}</TableHead>
                    <TableHead className="text-end">
                      <span className="sr-only">{tc("actions")}</span>
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
                      <TableCell>{d.isActive ? <Badge variant="success">{t("active")}</Badge> : <Badge variant="secondary">{t("inactive")}</Badge>}</TableCell>
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
