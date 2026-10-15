import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAuth } from "@/server/auth/context";
import { visibleNav } from "@/components/layout/nav";
import { SidebarNav, type SidebarGroup } from "@/components/layout/sidebar-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { pendingApprovalCount } from "@/server/services/leave/request.service";
import { listNotifications } from "@/server/services/notification.service";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();
  const t = await getTranslations("nav");
  const [approvals, notifications] = await Promise.all([pendingApprovalCount(ctx), listNotifications(ctx, { take: 8 })]);
  const groups: SidebarGroup[] = visibleNav(ctx.permissions, !!ctx.employeeId).map((g) => ({
    label: t(g.labelKey),
    items: g.items.map((i) => ({
      href: i.href,
      icon: i.icon,
      badge: i.badge === "approvals" ? approvals : undefined,
      // Managers without company-wide access see "My team".
      label:
        i.labelKey === "employees" && !ctx.permissions.has("employee.read.all")
          ? t("myTeam")
          : i.labelKey === "allRequests" && !ctx.permissions.has("leave.request.read.all")
            ? t("teamRequests")
            : t(i.labelKey),
    })),
  }));

  const brand = (
    <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
      {ctx.companyLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/api/files/logo" alt="" className="size-7 rounded object-contain" />
      ) : (
        <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded text-xs font-bold" aria-hidden>
          {ctx.companyName.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="truncate">{ctx.companyName}</span>
    </Link>
  );

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="bg-primary text-primary-foreground sr-only z-50 rounded px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <aside className="bg-sidebar sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-14 items-center border-b px-4">{brand}</div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav groups={groups} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur">
          <MobileNav groups={groups} label={t("openMenu")} brand={brand} />
          <div className="lg:hidden">{brand}</div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle label={t("toggleTheme")} />
            <NotificationBell
              unread={notifications.unread}
              items={notifications.items.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, read: !!n.readAt, createdAt: n.createdAt.toISOString() }))}
              label={t("notifications")}
            />
            <UserMenu
              name={ctx.employeeName ?? ctx.name}
              email={ctx.email}
              roles={ctx.roles.map((r) => r.name)}
              employeeId={ctx.employeeId}
              photoPath={ctx.photoPath}
              labels={{ profile: t("profile"), changePassword: t("changePassword"), signOut: t("signOut") }}
            />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
