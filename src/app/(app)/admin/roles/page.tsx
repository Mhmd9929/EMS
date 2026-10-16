import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Messages } from "@/i18n/messages";
import { Fragment } from "react";
import { Check, Lock } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { listRoles, permissionCatalogue } from "@/server/services/admin.service";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoleDialog, DeleteRoleButton } from "./role-dialog";
import { roleLabel } from "./role-label";

type PermissionMessage = keyof Messages["admin"]["permissions"];

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin"))("roles.title") };
}

export default async function RolesPage() {
  const ctx = await requireAuth();
  requirePermission(ctx, "role.manage");
  const roles = await listRoles(ctx);
  const t = await getTranslations("admin");
  // Permission keys stay as-is; module names and descriptions are shown translated.
  const catalogue = permissionCatalogue().map((p) => ({
    key: p.key,
    module: t(`modules.${p.module}`),
    description: t(`permissions.${p.key.replaceAll(".", "_") as PermissionMessage}`),
  }));
  const modules = [...new Set(catalogue.map((p) => p.module))];
  return (
    <>
      <PageHeader title={t("roles.title")} description={t("roles.description")} actions={<RoleDialog catalogue={catalogue} />} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((r) => {
          const label = roleLabel(t, r);
          return (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {label.name}
                  {r.locked && <Lock className="text-muted-foreground size-3.5" aria-label={t("roles.locked")} />}
                  {r.isSystem ? <Badge variant="secondary">{t("roles.system")}</Badge> : <Badge variant="outline">{t("roles.custom")}</Badge>}
                </CardTitle>
                <CardDescription>{label.description ?? "—"}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{t("roles.counts", { permissions: r.permissions.length, users: r.userCount })}</span>
                <span className="flex gap-1">
                  {!r.locked && <RoleDialog catalogue={catalogue} role={{ id: r.id, name: r.name, description: r.description, permissions: r.permissions }} />}
                  {!r.isSystem && <DeleteRoleButton roleId={r.id} name={r.name} />}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <h2 className="mt-10 mb-3 text-lg font-semibold">{t("roles.matrix")}</h2>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("roles.permission")}</TableHead>
              {roles.map((r) => (
                <TableHead key={r.id} className="text-center">
                  {roleLabel(t, r).name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((m) => (
              <Fragment key={m}>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={roles.length + 1} className="text-xs font-semibold tracking-wide uppercase">
                    {m}
                  </TableCell>
                </TableRow>
                {catalogue
                  .filter((p) => p.module === m)
                  .map((p) => (
                    <TableRow key={p.key}>
                      <TableCell>
                        <p className="font-mono text-xs" dir="ltr">
                          {p.key}
                        </p>
                        <p className="text-muted-foreground text-xs">{p.description}</p>
                      </TableCell>
                      {roles.map((r) => (
                        <TableCell key={r.id} className="text-center">
                          {r.permissions.includes(p.key) ? (
                            <Check className="text-success mx-auto size-4" aria-label={t("roles.granted")} />
                          ) : (
                            <span className="sr-only">{t("roles.notGranted")}</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
