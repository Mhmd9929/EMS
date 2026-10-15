import type { Metadata } from "next";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { USER_SORTS, listUsers } from "@/server/services/user.service";
import { listRoles } from "@/server/services/admin.service";
import { first, parseListParams, type SearchParams } from "@/lib/list-params";
import { formatDateTime } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeader } from "@/components/data-table/sort-header";
import { Pagination } from "@/components/data-table/pagination";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/empty-state";
import { UserRowActions } from "./user-row-actions";

export const metadata: Metadata = { title: "Users & access" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "user.manage");
  const sp = await searchParams;
  const params = parseListParams(sp, { sortable: USER_SORTS, defaultSort: "name" });
  const stateParam = first(sp.state);
  const state = stateParam === "active" || stateParam === "inactive" || stateParam === "pending" ? stateParam : undefined;
  const [result, roles] = await Promise.all([listUsers(ctx, params, { roleId: first(sp.role), state }), listRoles(ctx)]);
  const path = "/admin/users";
  const roleOptions = roles.map((r) => ({ id: r.id, name: r.name, key: r.key }));
  return (
    <>
      <PageHeader title="Users & access" description="Login accounts, role assignments and access. A user can hold several roles." />
      <Toolbar>
        <SearchInput placeholder="Search name or email…" />
        <FilterSelect param="role" label="Role" options={roles.map((r) => ({ value: r.id, label: r.name }))} />
        <FilterSelect
          param="state"
          label="State"
          options={[
            { value: "active", label: "Active" },
            { value: "pending", label: "Invitation pending" },
            { value: "inactive", label: "Disabled" },
          ]}
        />
        <ClearFilters params={["q", "role", "state"]} />
      </Toolbar>
      {result.items.length === 0 ? (
        <EmptyState icon={UsersRound} title="No users match" />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label="Name" sortKey="name" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                <SortHeader label="Email" sortKey="email" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} className="hidden md:table-cell" />
                <TableHead>Roles</TableHead>
                <TableHead>State</TableHead>
                <SortHeader label="Last sign-in" sortKey="lastLogin" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} className="hidden lg:table-cell" />
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    {u.employee ? (
                      <Link href={`/employees/${u.employee.id}`} className="font-medium hover:underline">
                        {u.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{u.name}</span>
                    )}
                    <p className="text-muted-foreground text-xs md:hidden">{u.email}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{u.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 && <span className="text-muted-foreground text-xs">No roles</span>}
                      {u.roles.map((r) => (
                        <Badge key={r.id} variant={r.key === "SUPER_ADMIN" ? "default" : "secondary"}>
                          {r.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {!u.isActive ? <Badge variant="destructive">Disabled</Badge> : u.activated ? <Badge variant="success">Active</Badge> : <Badge variant="warning">Pending</Badge>}
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">{formatDateTime(u.lastLoginAt, ctx.timezone)}</TableCell>
                  <TableCell className="text-right">
                    <UserRowActions user={{ id: u.id, name: u.name, isActive: u.isActive, activated: u.activated, roleIds: u.roles.map((r) => r.id) }} roles={roleOptions} isSelf={u.id === ctx.userId} />
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
