import type { Metadata } from "next";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { getOrgChartData } from "@/server/services/employee.service";
import { getVisibleEmployeeScope } from "@/server/rbac/scope";
import { PageHeader } from "@/components/page-header";
import { OrgChart } from "./org-chart";

export const metadata: Metadata = { title: "Org chart" };

export default async function OrgChartPage() {
  const ctx = await requireAuth();
  requirePermission(ctx, "orgchart.read");
  const [data, scope] = await Promise.all([getOrgChartData(ctx), getVisibleEmployeeScope(ctx)]);
  return (
    <>
      <PageHeader title="Org chart" description="Drag to pan, scroll or use the buttons to zoom. Click anyone to see their card." />
      <OrgChart persons={data.persons} departments={data.departments} profileAccess={scope === "all" ? "all" : scope} selfId={ctx.employeeId} />
    </>
  );
}
