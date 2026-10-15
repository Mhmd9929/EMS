"use client";
import { useState } from "react";
import { Menu } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { SheetContent } from "@/components/ui/dialog";
import { SidebarNav, type SidebarGroup } from "./sidebar-nav";

export function MobileNav({ groups, label, brand }: { groups: SidebarGroup[]; label: string; brand: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={label}>
          <Menu aria-hidden />
        </Button>
      </DialogPrimitive.Trigger>
      <SheetContent aria-describedby={undefined}>
        <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
        <div className="border-b px-4 py-3">{brand}</div>
        <div className="overflow-y-auto">
          <SidebarNav groups={groups} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </DialogPrimitive.Root>
  );
}
