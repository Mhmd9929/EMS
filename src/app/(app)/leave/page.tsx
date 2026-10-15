import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, Plane } from "lucide-react";
import { requireAuth } from "@/server/auth/context";
import { getEmployeeBalances } from "@/server/services/leave/balance.service";
import { REQUEST_SORTS, listLeaveRequests } from "@/server/services/leave/request.service";
import { listLeaveTypes } from "@/server/services/leave/config.service";
import { first, parseListParams, type SearchParams } from "@/lib/list-params";
import { formatDate, todayInTimeZone } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeader } from "@/components/data-table/sort-header";
import { Pagination } from "@/components/data-table/pagination";
import { ClearFilters, FilterSelect, Toolbar } from "@/components/data-table/toolbar";
import { hrefWith } from "@/components/data-table/url";
import { EmptyState } from "@/components/empty-state";
import { BalanceCards } from "@/components/leave/balance-cards";
import { LEAVE_STATUSES, LeaveStatusBadge, LeaveTypeLabel } from "@/components/leave/leave-badges";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My leave" };

export default async function MyLeavePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  if (!ctx.employeeId) redirect("/leave/calendar");
  const sp = await searchParams;
  const thisYear = todayInTimeZone(ctx.timezone).getUTCFullYear();
  const year = Number(first(sp.year)) || thisYear;
  const params = parseListParams(sp, { sortable: REQUEST_SORTS, defaultSort: "startDate", defaultDir: "desc", defaultPageSize: 10 });
  const status = LEAVE_STATUSES.some((s) => s.value === first(sp.status)) ? (first(sp.status) as never) : undefined;
  const [balances, requests, types] = await Promise.all([
    getEmployeeBalances(ctx, ctx.employeeId, year),
    listLeaveRequests(ctx, "mine", params, { status, year, leaveTypeId: first(sp.type) }),
    listLeaveTypes(ctx),
  ]);
  const path = "/leave";

  return (
    <>
      <PageHeader
        title="My leave"
        description="Your balances and requests. Balances are per calendar year."
        actions={
          <Link href="/leave/apply" className={buttonVariants()}>
            <CalendarPlus aria-hidden /> Apply for leave
          </Link>
        }
      />
      {sp.withdrawn && <Alert variant="success" className="mb-4">Request withdrawn.</Alert>}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Balances {year}</h2>
        <nav aria-label="Year" className="flex gap-1 rounded-lg border p-0.5 text-sm">
          {[thisYear - 1, thisYear, thisYear + 1].map((y) => (
            <Link key={y} href={hrefWith(path, sp, { year: y === thisYear ? undefined : y, page: undefined })} aria-current={y === year ? "page" : undefined} className={cn("rounded-md px-3 py-1", y === year ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {y}
            </Link>
          ))}
        </nav>
      </div>
      <BalanceCards balances={balances} />

      <h2 className="mt-10 mb-3 text-lg font-semibold">My requests</h2>
      <Toolbar>
        <FilterSelect param="status" label="Status" options={LEAVE_STATUSES} />
        <FilterSelect param="type" label="Type" options={types.map((t) => ({ value: t.id, label: t.name }))} />
        <ClearFilters params={["status", "type"]} />
      </Toolbar>
      {requests.items.length === 0 ? (
        <EmptyState icon={Plane} title={`No requests in ${year}`} description="When you apply for leave it shows up here with its approval status." action={<Link href="/leave/apply" className={buttonVariants({ variant: "outline" })}>Apply for leave</Link>} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <SortHeader label="Dates" sortKey="startDate" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                <SortHeader label="Days" sortKey="days" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                <TableHead>Status</TableHead>
                <SortHeader label="Requested" sortKey="createdAt" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} className="hidden md:table-cell" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/leave/requests/${r.id}`} className="font-medium hover:underline">
                      <LeaveTypeLabel name={r.leaveType.name} color={r.leaveType.color} />
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(r.startDate)}
                    {r.endDate.getTime() !== r.startDate.getTime() && ` – ${formatDate(r.endDate)}`}
                    {r.halfDay !== "NONE" && <span className="text-muted-foreground"> ({r.halfDay === "FIRST_HALF" ? "morning" : "afternoon"})</span>}
                  </TableCell>
                  <TableCell className="tabular-nums">{r.days}</TableCell>
                  <TableCell>
                    <LeaveStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm md:table-cell">{formatDate(r.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <Pagination {...requests} pathname={path} searchParams={sp} />
    </>
  );
}
