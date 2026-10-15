"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, Briefcase, FileUp, LayoutDashboard, MapPin, Network, ScrollText, Settings, ShieldCheck, UserCircle, Users, UsersRound, BookUser,
  Plane, CheckSquare, CalendarDays, ListChecks, Scale, BarChart3, SlidersHorizontal,
} from "lucide-react";
import type { NavIcon } from "./nav";
import { cn } from "@/lib/utils";

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
};

export type SidebarGroup = { label: string; items: { href: string; label: string; icon: NavIcon; badge?: number }[] };

export function SidebarNav({ groups, onNavigate }: { groups: SidebarGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  // Longest matching prefix wins, so /employees/import doesn't also highlight /employees.
  const all = groups.flatMap((g) => g.items.map((i) => i.href));
  const active = all
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
  return (
    <nav aria-label="Main" className="flex flex-col gap-5 px-3 py-4">
      {groups.map((g) => (
        <div key={g.label} className="space-y-1">
          <p className="text-muted-foreground px-2 text-xs font-medium tracking-wide uppercase">{g.label}</p>
          {g.items.map((item) => {
            const Icon = ICONS[item.icon];
            const isActive = item.href === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                  isActive ? "bg-sidebar-accent text-foreground font-medium" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
                {!!item.badge && (
                  <span className="bg-primary text-primary-foreground ml-auto rounded-full px-1.5 text-[11px] leading-5 font-semibold tabular-nums" aria-label={`${item.badge} waiting`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
