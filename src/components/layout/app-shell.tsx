"use client";
import { useState } from "react";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { SidebarNav, type SidebarGroup } from "./sidebar-nav";
import { MobileNav } from "./mobile-nav";
import { cn } from "@/lib/utils";
import { SIDEBAR_COOKIE } from "./sidebar-cookie";


/**
 * Authenticated shell: black sidebar (collapsible to an icon rail; the choice is kept in a cookie so the
 * server renders the right width) and a top header in the style chosen in src/theme/brand.ts.
 */
export function AppShell({
  groups,
  initiallyCollapsed,
  headerStyle,
  controls,
  labels,
  children,
}: {
  groups: SidebarGroup[];
  initiallyCollapsed: boolean;
  headerStyle: "dark" | "light";
  controls: React.ReactNode;
  labels: { openMenu: string; collapse: string; expand: string; skip: string; portal: string };
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  };
  const sidebarBrand = (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5" aria-label={labels.portal}>
      <BrandLogo variant="icon" className="size-9 shrink-0" />
      {!collapsed && <span className="text-sidebar-foreground truncate text-sm font-semibold">{labels.portal}</span>}
    </Link>
  );
  return (
    <div className="flex min-h-screen">
      <a href="#main" className="bg-primary text-primary-foreground sr-only z-50 rounded px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:start-2">
        {labels.skip}
      </a>
      <aside
        className={cn(
          "dark bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-screen shrink-0 flex-col border-e transition-[width] duration-200 lg:flex",
          collapsed ? "w-[4.25rem]" : "w-64",
        )}
      >
        <div className={cn("border-sidebar-border flex h-14 items-center border-b", collapsed ? "justify-center px-2" : "px-4")}>{sidebarBrand}</div>
        <div className="flex-1 overflow-x-hidden overflow-y-auto">
          <SidebarNav groups={groups} collapsed={collapsed} />
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? labels.expand : labels.collapse}
          title={collapsed ? labels.expand : labels.collapse}
          className={cn(
            "border-sidebar-border text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground flex h-11 items-center gap-2 border-t text-sm transition-colors",
            collapsed ? "justify-center" : "px-5",
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-4 rtl:-scale-x-100" aria-hidden /> : <PanelLeftClose className="size-4 rtl:-scale-x-100" aria-hidden />}
          {!collapsed && labels.collapse}
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "sticky top-0 z-30 flex h-14 items-center gap-2 px-4",
            headerStyle === "dark"
              ? "dark bg-header-dark text-header-dark-foreground border-sidebar-border border-b"
              : "bg-header-light text-header-light-foreground border-primary border-b-2",
          )}
        >
          <MobileNav groups={groups} label={labels.openMenu} brand={sidebarBrand} />
          <Link href="/dashboard" className="flex items-center" aria-label={labels.portal}>
            <BrandLogo variant="icon" className="size-8 lg:hidden" />
            {collapsed ? <BrandLogo variant="icon" className="hidden size-8 lg:block" /> : <BrandLogo variant="full" className="hidden h-9 lg:block" />}
          </Link>
          <div className="ms-auto flex items-center gap-1">{controls}</div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
