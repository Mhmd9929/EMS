import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { getOrgChartData } from "@/server/services/employee.service";
import { getVisibleEmployeeScope } from "@/server/rbac/scope";
import { PageHeader } from "@/components/page-header";
import { OrgChart } from "./org-chart";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("orgChart"))("meta.title") };
}

export default async function OrgChartPage() {
  const ctx = await requireAuth();
  requirePermission(ctx, "orgchart.read");
  const [data, scope] = await Promise.all([getOrgChartData(ctx), getVisibleEmployeeScope(ctx)]);
  const t = await getTranslations("orgChart");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <OrgChart persons={data.persons} departments={data.departments} profileAccess={scope === "all" ? "all" : scope} selfId={ctx.employeeId} />
    </>
  );
}
