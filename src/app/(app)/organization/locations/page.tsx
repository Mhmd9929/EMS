import type { Metadata } from "next";
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

export const metadata: Metadata = { title: "Locations" };

export default async function LocationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "org.manage");
  const sp = await searchParams;
  const params = parseListParams(sp, { sortable: LOCATION_SORTS, defaultSort: "name" });
  const active = first(sp.active);
  const result = await listLocations(ctx, params, { active: active === "yes" ? true : active === "no" ? false : undefined });
  const path = "/organization/locations";
  return (
    <>
      <PageHeader title="Locations" description="Branches and sites. Optional per employee; used for location-specific holidays." actions={<LocationDialog />} />
      <Toolbar>
        <SearchInput placeholder="Search name, code, city…" />
        <FilterSelect param="active" label="Status" options={[{ value: "yes", label: "Active" }, { value: "no", label: "Inactive" }]} />
        <ClearFilters params={["q", "active"]} />
      </Toolbar>
      {result.items.length === 0 ? (
        <EmptyState icon={MapPin} title={params.q ? "No locations match" : "No locations yet"} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label="Name" sortKey="name" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                <SortHeader label="Code" sortKey="code" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                <SortHeader label="City" sortKey="city" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} className="hidden sm:table-cell" />
                <TableHead className="hidden md:table-cell">Emirate</TableHead>
                <TableHead>People</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
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
                  <TableCell className="hidden md:table-cell">{l.emirate ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{l._count.employees}</TableCell>
                  <TableCell>{l.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                  <TableCell className="text-right">
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
