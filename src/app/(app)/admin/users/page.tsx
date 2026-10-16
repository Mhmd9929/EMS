import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { USER_SORTS, listUsers } from "@/server/services/user.service";
import { listRoles } from "@/server/services/admin.service";
import { first, parseListParams, type SearchParams } from "@/lib/list-params";
import { getFormat } from "@/server/i18n";
import { roleLabel } from "../roles/role-label";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeader } from "@/components/data-table/sort-header";
import { Pagination } from "@/components/data-table/pagination";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/empty-state";
import { UserRowActions } from "./user-row-actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin"))("users.title") };
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "user.manage");
  const sp = await searchParams;
  const params = parseListParams(sp, { sortable: USER_SORTS, defaultSort: "name" });
  const stateParam = first(sp.state);
  const state = stateParam === "active" || stateParam === "inactive" || stateParam === "pending" ? stateParam : undefined;
  const [result, roles] = await Promise.all([listUsers(ctx, params, { roleId: first(sp.role), state }), listRoles(ctx)]);
  const path = "/admin/users";
  const t = await getTranslations("admin");
  const tc = await getTranslations("common");
  const f = await getFormat();
  const roleName = (r: { key: string; name: string }) => roleLabel(t, r).name;
  const roleOptions = roles.map((r) => ({ id: r.id, name: roleName(r), key: r.key }));
  return (
    <>
      <PageHeader title={t("users.title")} description={t("users.description")} />
      <Toolbar>
        <SearchInput placeholder={t("users.search")} />
        <FilterSelect param="role" label={t("users.role")} options={roles.map((r) => ({ value: r.id, label: roleName(r) }))} />
        <FilterSelect
          param="state"
          label={t("users.state")}
          options={[
            { value: "active", label: t("users.states.active") },
            { value: "pending", label: t("users.states.pending") },
            { value: "inactive", label: t("users.states.inactive") },
          ]}
        />
        <ClearFilters params={["q", "role", "state"]} />
      </Toolbar>
      {result.items.length === 0 ? (
        <EmptyState icon={UsersRound} title={t("users.empty")} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label={tc("name")} sortKey="name" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                <SortHeader label={tc("email")} sortKey="email" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} className="hidden md:table-cell" />
                <TableHead>{t("users.columns.roles")}</TableHead>
                <TableHead>{t("users.state")}</TableHead>
                <SortHeader label={t("users.columns.lastSignIn")} sortKey="lastLogin" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} className="hidden lg:table-cell" />
                <TableHead className="text-end">
                  <span className="sr-only">{tc("actions")}</span>
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
                    <p className="text-muted-foreground text-xs md:hidden">
                      <span dir="ltr">{u.email}</span>
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span dir="ltr">{u.email}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 && <span className="text-muted-foreground text-xs">{t("users.noRoles")}</span>}
                      {u.roles.map((r) => (
                        <Badge key={r.id} variant={r.key === "SUPER_ADMIN" ? "default" : "secondary"}>
                          {roleName(r)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {!u.isActive ? <Badge variant="destructive">{t("users.badges.disabled")}</Badge> : u.activated ? <Badge variant="success">{t("active")}</Badge> : <Badge variant="warning">{t("users.badges.pending")}</Badge>}
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">{f.dateTime(u.lastLoginAt, ctx.timezone)}</TableCell>
                  <TableCell className="text-end">
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
