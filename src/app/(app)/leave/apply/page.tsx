import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/server/auth/context";
import { applicableLeaveTypes } from "@/server/services/leave/request.service";
import { PageHeader } from "@/components/page-header";
import { todayInTimeZone, toDateInput } from "@/lib/dates";
import { ApplyLeaveForm } from "./apply-form";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("leave"))("meta.apply") };
}

export default async function ApplyLeavePage() {
  const ctx = await requireAuth();
  if (!ctx.employeeId) redirect("/leave/calendar");
  const [types, t] = await Promise.all([applicableLeaveTypes(ctx), getTranslations("leave")]);
  return (
    <>
      <PageHeader title={t("apply.title")} description={t("apply.description")} />
      <ApplyLeaveForm types={types} today={toDateInput(todayInTimeZone(ctx.timezone))} />
    </>
  );
}
