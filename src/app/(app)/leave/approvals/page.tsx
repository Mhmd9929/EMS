import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/server/auth/context";
import { approvalInbox } from "@/server/services/leave/request.service";
import { delegateOptions, listMyDelegations } from "@/server/services/leave/delegation.service";
import { first, type SearchParams } from "@/lib/list-params";
import { todayInTimeZone, toDateInput } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { InboxTable } from "./inbox-table";
import { Delegations } from "./delegations";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("leave"))("meta.approvals") };
}

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  const sp = await searchParams;
  const canAll = ctx.permissions.has("leave.approve.all");
  const view = first(sp.view) === "all" && canAll ? "all" : "mine";
  const [items, delegations, options] = await Promise.all([approvalInbox(ctx, view), listMyDelegations(ctx), delegateOptions(ctx)]);
  const isApprover = ctx.permissions.has("leave.approve.team") || canAll;
  const [t, te] = await Promise.all([getTranslations("leave.approvals"), getTranslations("enums")]);
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {canAll && (
        <nav className="mb-4 flex w-fit gap-1 rounded-lg border p-0.5 text-sm" aria-label={t("inboxView")}>
          {(["mine", "all"] as const).map((v) => (
            <Link key={v} href={v === "mine" ? "/leave/approvals" : "/leave/approvals?view=all"} aria-current={view === v ? "page" : undefined} className={cn("rounded-md px-3 py-1", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {v === "mine" ? t("waitingForMe") : t("allPending")}
            </Link>
          ))}
        </nav>
      )}
      <InboxTable
        items={items.map((i) => ({
          id: i.request.id,
          kind: i.kind,
          stepLabel: te(`approvalRole.${i.approverRole === "HR" ? "HR" : "MANAGER"}`),
          approverName: i.approverName,
          onBehalfOf: i.onBehalfOf,
          waitingSince: i.waitingSince.toISOString(),
          employee: { id: i.request.employee.id, name: `${i.request.employee.preferredName || i.request.employee.firstName} ${i.request.employee.lastName}`, firstName: i.request.employee.firstName, lastName: i.request.employee.lastName, hasPhoto: !!i.request.employee.photoPath, title: i.request.employee.position?.title ?? null, department: i.request.employee.department?.name ?? null },
          type: i.request.leaveType,
          startDate: toDateInput(i.request.startDate),
          endDate: toDateInput(i.request.endDate),
          days: i.request.days,
          reason: i.request.reason,
          cancellationReason: i.request.cancellationReason,
        }))}
      />
      {(isApprover || delegations.given.length > 0) && (
        <Delegations
          given={delegations.given.map((d) => ({ id: d.id, delegate: d.delegate.name, start: toDateInput(d.startDate), end: toDateInput(d.endDate), reason: d.reason, isActive: d.isActive }))}
          received={delegations.received.map((d) => ({ id: d.id, delegator: d.delegator.name, start: toDateInput(d.startDate), end: toDateInput(d.endDate) }))}
          options={options}
          today={toDateInput(todayInTimeZone(ctx.timezone))}
        />
      )}
    </>
  );
}
