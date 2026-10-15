import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/server/auth/context";
import { applicableLeaveTypes } from "@/server/services/leave/request.service";
import { PageHeader } from "@/components/page-header";
import { todayInTimeZone, toDateInput } from "@/lib/dates";
import { ApplyLeaveForm } from "./apply-form";

export const metadata: Metadata = { title: "Apply for leave" };

export default async function ApplyLeavePage() {
  const ctx = await requireAuth();
  if (!ctx.employeeId) redirect("/leave/calendar");
  const types = await applicableLeaveTypes(ctx);
  return (
    <>
      <PageHeader title="Apply for leave" description="Working days are calculated live — weekends and public holidays are excluded unless the leave type counts them." />
      <ApplyLeaveForm types={types} today={toDateInput(todayInTimeZone(ctx.timezone))} />
    </>
  );
}
