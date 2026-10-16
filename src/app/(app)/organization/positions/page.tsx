import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("organization"))("positions.title") };
}

export default async function PositionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "org.manage");
  const sp = await searchParams;
  const params = parseListParams(sp, { sortable: POSITION_SORTS, defaultSort: "title" });
  const active = first(sp.active);
  const result = await listPositions(ctx, params, { active: active === "yes" ? true : active === "no" ? false : undefined });
  const path = "/organization/positions";
  const t = await getTranslations("organization");
  const tc = await getTranslations("common");
  const sort = (label: string, key: (typeof POSITION_SORTS)[number], className?: string) => (
    <SortHeader label={label} sortKey={key} current={params.sort} dir={params.dir} pathname={path} searchParams={sp} className={className} />
  );
  return (
    <>
      <PageHeader title={t("positions.title")} description={t("positions.description")} actions={<PositionDialog />} />
      <Toolbar>
        <SearchInput placeholder={t("positions.search")} />
        <FilterSelect param="active" label={tc("status")} options={[{ value: "yes", label: t("active") }, { value: "no", label: t("inactive") }]} />
        <ClearFilters params={["q", "active"]} />
      </Toolbar>
      {result.items.length === 0 ? (
        <EmptyState icon={Briefcase} title={params.q ? t("positions.noMatch") : t("positions.empty")} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                {sort(t("positions.columns.title"), "title")}
                {sort(t("code"), "code")}
                {sort(t("positions.columns.grade"), "grade", "hidden sm:table-cell")}
                {sort(t("positions.columns.level"), "level", "hidden sm:table-cell")}
                <TableHead>{t("people")}</TableHead>
                <TableHead>{tc("status")}</TableHead>
                <TableHead className="text-end">
                  <span className="sr-only">{tc("actions")}</span>
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
                  <TableCell>{p.isActive ? <Badge variant="success">{t("active")}</Badge> : <Badge variant="secondary">{t("inactive")}</Badge>}</TableCell>
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
