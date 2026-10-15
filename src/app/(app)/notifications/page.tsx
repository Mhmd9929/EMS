import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { requireAuth } from "@/server/auth/context";
import { listNotifications } from "@/server/services/notification.service";
import { first, type SearchParams } from "@/lib/list-params";
import { formatDateTime } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/data-table/pagination";
import { NotificationList } from "./notification-list";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  const sp = await searchParams;
  const page = Math.max(1, Number(first(sp.page)) || 1);
  const pageSize = 20;
  const { items, total, unread } = await listNotifications(ctx, { take: pageSize, page });
  return (
    <>
      <PageHeader title="Notifications" description={unread ? `${unread} unread` : "You're all caught up."} />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" />
      ) : (
        <Card className="py-0">
          <NotificationList
            unread={unread}
            items={items.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, read: !!n.readAt, when: formatDateTime(n.createdAt, ctx.timezone) }))}
          />
        </Card>
      )}
      <Pagination page={page} pageSize={pageSize} total={total} pageCount={Math.max(1, Math.ceil(total / pageSize))} pathname="/notifications" searchParams={sp} />
    </>
  );
}
