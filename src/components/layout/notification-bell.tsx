"use client";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/server/actions/leave.actions";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; body: string; link: string | null; read: boolean; createdAt: string };

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationBell({ unread, items, label }: { unread: number; items: Item[]; label: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  const open = (n: Item) =>
    start(async () => {
      await markNotificationReadAction(n.id);
      if (n.link) router.push(n.link);
      else router.refresh();
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `${label} (${unread} unread)` : label}>
          <Bell aria-hidden />
          {unread > 0 && (
            <span className="bg-destructive absolute top-1 end-1 min-w-4 rounded-full px-1 text-[10px] leading-4 font-semibold text-destructive-foreground tabular-nums">{unread > 9 ? "9+" : unread}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {unread > 0 && (
            <button className="text-link px-2 text-xs hover:underline" onClick={() => start(async () => void (await markAllNotificationsReadAction(), router.refresh()))}>
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 && <p className="text-muted-foreground px-2 py-6 text-center text-sm">You&apos;re all caught up.</p>}
        {items.map((n) => (
          <DropdownMenuItem key={n.id} onSelect={() => open(n)} className="flex-col items-start gap-0.5">
            <span className={cn("flex w-full items-center gap-2 text-sm", !n.read && "font-semibold")}>
              {!n.read && <span className="bg-primary size-2 shrink-0 rounded-full" aria-label="Unread" />}
              <span className="truncate">{n.title}</span>
            </span>
            <span className="text-muted-foreground line-clamp-2 text-xs">{n.body}</span>
            <span className="text-muted-foreground text-[11px]">{timeAgo(n.createdAt)}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/notifications" className="justify-center text-sm">
            View all
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
