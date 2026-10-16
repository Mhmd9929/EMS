import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { LOCATION_SORTS, listLocations } from "@/server/services/org.service";
import { first, parseListParams, type SearchParams } from "@/lib/list-params";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeader } from "@/components/data-table/sort-header";
import { Pagination } from "@/components/data-table/pagination";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/empty-state";
import { LocationDialog } from "./location-dialog";
import { UAE_EMIRATES } from "@/lib/constants";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("organization"))("locations.title") };
}

export default async function LocationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "org.manage");
  const sp = await searchParams;
  const params = parseListParams(sp, { sortable: LOCATION_SORTS, defaultSort: "name" });
  const active = first(sp.active);
  const result = await listLocations(ctx, params, { active: active === "yes" ? true : active === "no" ? false : undefined });
  const path = "/organization/locations";
  const t = await getTranslations("organization");
  const tc = await getTranslations("common");
  const te = await getTranslations("enums");
  const emirateLabel = (e: string) => ((UAE_EMIRATES as readonly string[]).includes(e) ? te(`emirate.${e as (typeof UAE_EMIRATES)[number]}`) : e);
  return (
    <>
      <PageHeader title={t("locations.title")} description={t("locations.description")} actions={<LocationDialog />} />
      <Toolbar>
        <SearchInput placeholder={t("locations.search")} />
        <FilterSelect param="active" label={tc("status")} options={[{ value: "yes", label: t("active") }, { value: "no", label: t("inactive") }]} />
        <ClearFilters params={["q", "active"]} />
      </Toolbar>
      {result.items.length === 0 ? (
        <EmptyState icon={MapPin} title={params.q ? t("locations.noMatch") : t("locations.empty")} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label={tc("name")} sortKey="name" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                <SortHeader label={t("code")} sortKey="code" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                <SortHeader label={t("locations.columns.city")} sortKey="city" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} className="hidden sm:table-cell" />
                <TableHead className="hidden md:table-cell">{t("locations.columns.emirate")}</TableHead>
                <TableHead>{t("people")}</TableHead>
                <TableHead>{tc("status")}</TableHead>
                <TableHead className="text-end">
                  <span className="sr-only">{tc("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <p className="font-medium">{l.name}</p>
                    {l.address && <p className="text-muted-foreground text-xs">{l.address}</p>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.code}</TableCell>
                  <TableCell className="hidden sm:table-cell">{l.city ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{l.emirate ? emirateLabel(l.emirate) : "—"}</TableCell>
                  <TableCell className="tabular-nums">{l._count.employees}</TableCell>
                  <TableCell>{l.isActive ? <Badge variant="success">{t("active")}</Badge> : <Badge variant="secondary">{t("inactive")}</Badge>}</TableCell>
                  <TableCell className="text-end">
                    <LocationDialog location={{ id: l.id, name: l.name, code: l.code, address: l.address, city: l.city, emirate: l.emirate, country: l.country, isActive: l.isActive }} />
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
