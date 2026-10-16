"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, Briefcase, FileUp, LayoutDashboard, MapPin, Network, ScrollText, Settings, ShieldCheck, UserCircle, Users, UsersRound, BookUser,
  Plane, CheckSquare, CalendarDays, ListChecks, Scale, BarChart3, SlidersHorizontal,
  Receipt, Banknote, Wallet, PlusCircle, Handshake, Cog,
} from "lucide-react";
import type { NavIcon } from "./nav";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  directory: BookUser,
  orgchart: Network,
  profile: UserCircle,
  employees: Users,
  import: FileUp,
  departments: Building2,
  positions: Briefcase,
  locations: MapPin,
  users: UsersRound,
  roles: ShieldCheck,
  audit: ScrollText,
  settings: Settings,
  leave: Plane,
  approvals: CheckSquare,
  calendar: CalendarDays,
  requests: ListChecks,
  balances: Scale,
  reports: BarChart3,
  leaveSettings: SlidersHorizontal,
  payslips: Receipt,
  payrollRuns: Banknote,
  salaries: Wallet,
  adjustments: PlusCircle,
  settlements: Handshake,
  payrollSettings: Cog,
};

export type SidebarGroup = { label: string; items: { href: string; label: string; icon: NavIcon; badge?: number }[] };

export function SidebarNav({ groups, onNavigate, collapsed = false }: { groups: SidebarGroup[]; onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  // Longest matching prefix wins, so /employees/import doesn't also highlight /employees.
  const all = groups.flatMap((g) => g.items.map((i) => i.href));
  const active = all
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
  return (
    <nav aria-label={t("main")} className={cn("flex flex-col py-4", collapsed ? "gap-3 px-2" : "gap-5 px-3")}>
      {groups.map((g) => (
        <div key={g.label} className="space-y-0.5">
          {collapsed ? (
            <div className="border-sidebar-border mx-2 mb-2 border-t" role="separator" aria-label={g.label} />
          ) : (
            <p className="text-sidebar-muted px-3 pb-1 text-[11px] font-semibold tracking-wider uppercase">{g.label}</p>
          )}
          {g.items.map((item) => {
            const Icon = ICONS[item.icon];
            const isActive = item.href === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                aria-label={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-md border-s-2 py-2 text-sm transition-colors",
                  collapsed ? "justify-center px-0" : "px-3",
                  isActive
                    ? "border-sidebar-active text-sidebar-active bg-sidebar-accent font-semibold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent border-transparent",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {!collapsed && item.label}
                {!!item.badge &&
                  (collapsed ? (
                    <span className="bg-primary absolute end-1.5 top-1.5 size-2 rounded-full" aria-label={t("waiting", { count: item.badge })} />
                  ) : (
                    <span className="bg-primary text-primary-foreground ms-auto rounded-full px-1.5 text-[11px] leading-5 font-semibold tabular-nums" aria-label={t("waiting", { count: item.badge })}>
                      {item.badge}
                    </span>
                  ))}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
