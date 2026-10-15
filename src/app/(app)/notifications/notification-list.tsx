"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/server/actions/leave.actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; body: string; link: string | null; read: boolean; when: string };

export function NotificationList({ items, unread }: { items: Item[]; unread: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div>
      {unread > 0 && (
        <div className="flex justify-end border-b p-2">
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => void (await markAllNotificationsReadAction(), router.refresh()))}>
            Mark all as read
          </Button>
        </div>
      )}
      <ul className="divide-y">
        {items.map((n) => (
          <li key={n.id}>
            <button
              className={cn("hover:bg-accent/50 flex w-full gap-3 p-4 text-start", !n.read && "bg-primary/5")}
              onClick={() =>
                start(async () => {
                  await markNotificationReadAction(n.id);
                  if (n.link) router.push(n.link);
                  else router.refresh();
                })
              }
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} aria-label={n.read ? undefined : "Unread"} />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", !n.read && "font-semibold")}>{n.title}</span>
                <span className="text-muted-foreground block text-sm whitespace-pre-line">{n.body}</span>
                <span className="text-muted-foreground mt-1 block text-xs">{n.when}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
