import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { requireAuth } from "@/server/auth/context";
import { visibleNav } from "@/components/layout/nav";
import type { SidebarGroup } from "@/components/layout/sidebar-nav";
import { AppShell } from "@/components/layout/app-shell";
import { SIDEBAR_COOKIE } from "@/components/layout/sidebar-cookie";
import { HEADER_STYLE } from "@/theme/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
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

  const sidebarState = (await cookies()).get(SIDEBAR_COOKIE)?.value;

  return (
    <AppShell
      groups={groups}
      initiallyCollapsed={sidebarState === "collapsed"}
      headerStyle={HEADER_STYLE}
      labels={{ openMenu: t("openMenu"), collapse: t("collapseSidebar"), expand: t("expandSidebar"), skip: t("skipToContent"), portal: t("portal") }}
      controls={
        <>
          <LanguageSwitcher className="hidden sm:inline-flex" />
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
            labels={{ profile: t("profile"), changePassword: t("changePassword"), signOut: t("signOut"), accountMenu: t("accountMenu") }}
          />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
