import type { Metadata } from "next";
import { BookUser } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { DIRECTORY_SORTS, listDirectory } from "@/server/services/employee.service";
import { listDepartmentOptions, listLocationOptions } from "@/server/services/org.service";
import { getVisibleEmployeeScope } from "@/server/rbac/scope";
import { first, parseListParams, type SearchParams } from "@/lib/list-params";
import { PageHeader } from "@/components/page-header";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/data-table/toolbar";
import { Pagination } from "@/components/data-table/pagination";
import { EmptyState } from "@/components/empty-state";
import { DirectoryView } from "./directory-view";
import type { PersonCardData } from "@/components/person-card";

export const metadata: Metadata = { title: "Directory" };

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "directory.read");
  const sp = await searchParams;
  const params = parseListParams(sp, { sortable: DIRECTORY_SORTS, defaultSort: "name", defaultPageSize: 20 });
  const [result, departments, locations, scope] = await Promise.all([
    listDirectory(ctx, params, { departmentId: first(sp.department), locationId: first(sp.location) }),
    listDepartmentOptions(ctx),
    listLocationOptions(ctx),
    getVisibleEmployeeScope(ctx),
  ]);
  const visible = scope === "all" ? null : new Set(scope);
  const people: PersonCardData[] = result.items.map((e) => ({
    id: e.id,
    name: `${e.preferredName || e.firstName} ${e.lastName}`,
    firstName: e.firstName,
    lastName: e.lastName,
    title: e.position?.title ?? null,
    department: e.department?.name ?? null,
    location: e.location?.name ?? null,
    email: e.workEmail,
    manager: e.manager ? `${e.manager.preferredName || e.manager.firstName} ${e.manager.lastName}` : null,
    hasPhoto: !!e.photoPath,
    canOpenProfile: visible === null || visible.has(e.id),
  }));
  const view = first(sp.view) === "table" ? "table" : "cards";

  return (
    <>
      <PageHeader title="Company directory" description="Find colleagues by name, role or department." />
      <Toolbar>
        <SearchInput placeholder="Search name, title, department…" />
        <FilterSelect param="department" label="Department" options={departments} />
        <FilterSelect param="location" label="Location" options={locations} />
        <ClearFilters params={["q", "department", "location"]} />
      </Toolbar>
      {people.length === 0 ? (
        <EmptyState icon={BookUser} title="No one found" description="Try a different name or clear the filters." />
      ) : (
        <DirectoryView people={people} view={view} sp={sp} sort={params.sort} dir={params.dir} />
      )}
      <Pagination {...result} pathname="/directory" searchParams={sp} />
    </>
  );
}
