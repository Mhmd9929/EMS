import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Bell } from "lucide-react";
import { requireAuth } from "@/server/auth/context";
import { listNotifications } from "@/server/services/notification.service";
import { first, type SearchParams } from "@/lib/list-params";
import { getFormat } from "@/server/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/data-table/pagination";
import { NotificationList } from "./notification-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("notifications"))("meta.title") };
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  const sp = await searchParams;
  const page = Math.max(1, Number(first(sp.page)) || 1);
  const pageSize = 20;
  const { items, total, unread } = await listNotifications(ctx, { take: pageSize, page });
  const t = await getTranslations("notifications");
  const f = await getFormat();
  return (
    <>
      <PageHeader title={t("title")} description={unread ? t("unread", { count: unread }) : t("allCaughtUp")} />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title={t("empty")} />
      ) : (
        <Card className="py-0">
          <NotificationList
            unread={unread}
            items={items.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, read: !!n.readAt, when: f.dateTime(n.createdAt, ctx.timezone) }))}
          />
        </Card>
      )}
      <Pagination page={page} pageSize={pageSize} total={total} pageCount={Math.max(1, Math.ceil(total / pageSize))} pathname="/notifications" searchParams={sp} />
    </>
  );
}
