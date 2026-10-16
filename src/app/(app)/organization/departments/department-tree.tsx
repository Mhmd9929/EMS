"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TreeNode } from "@/lib/tree";
import { DepartmentDialog, type DepartmentValues } from "./department-dialog";

type Node = DepartmentValues & {
  head: { firstName: string; lastName: string; preferredName: string | null } | null;
  _count: { employees: number };
};

export function DepartmentTree({ tree, options }: { tree: TreeNode<Node>[]; options: React.ComponentProps<typeof DepartmentDialog>["options"] }) {
  const t = useTranslations("organization");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const render = (nodes: TreeNode<Node>[], depth: number): React.ReactNode => (
    <ul className={depth ? "ms-5 border-s ps-3" : ""}>
      {nodes.map((n) => (
        <li key={n.id} className="py-1">
          <div className="hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-1.5">
            {n.children.length ? (
              <button onClick={() => toggle(n.id)} aria-expanded={!collapsed.has(n.id)} aria-label={collapsed.has(n.id) ? t("departments.tree.expand", { name: n.name }) : t("departments.tree.collapse", { name: n.name })} className="text-muted-foreground">
                {collapsed.has(n.id) ? <ChevronRight className="size-4 rtl:-scale-x-100" /> : <ChevronDown className="size-4" />}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span className="font-medium">{n.name}</span>
            <span className="text-muted-foreground font-mono text-xs">{n.code}</span>
            {!n.isActive && <Badge variant="secondary">{t("inactive")}</Badge>}
            <span className="text-muted-foreground ms-auto hidden text-xs sm:inline">
              {n.head ? t("departments.tree.head", { name: `${n.head.preferredName || n.head.firstName} ${n.head.lastName}` }) : t("departments.tree.noHead")}
            </span>
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <Users className="size-3" aria-hidden /> {n._count.employees}
            </span>
            <DepartmentDialog options={options} department={n} />
          </div>
          {n.children.length > 0 && !collapsed.has(n.id) && render(n.children, depth + 1)}
        </li>
      ))}
    </ul>
  );
  return (
    <Card>
      <CardContent>{render(tree, 0)}</CardContent>
    </Card>
  );
}
