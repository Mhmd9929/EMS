"use client";
import { useMemo, useRef, useState } from "react";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchContentRef } from "react-zoom-pan-pinch";
import { ChevronDown, ChevronUp, Crosshair, Maximize2, Minimize2, Search, Users, ZoomIn, ZoomOut, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PersonCardDialog, type PersonCardData } from "@/components/person-card";
import { buildTree, pathToRoot, type TreeNode } from "@/lib/tree";
import { cn } from "@/lib/utils";
import type { OrgChartPerson } from "@/server/services/employee.service";

type Department = { id: string; name: string; code: string; parentId: string | null; headId: string | null };
type Mode = "reporting" | "department";

const DEFAULT_DEPTH = 2;

function initialCollapsed<T extends { id: string }>(roots: TreeNode<T>[], depth: number) {
  const collapsed = new Set<string>();
  const walk = (nodes: TreeNode<T>[], level: number) => {
    for (const n of nodes) {
      if (level >= depth && n.children.length) collapsed.add(n.id);
      walk(n.children, level + 1);
    }
  };
  walk(roots, 1);
  return collapsed;
}

export function OrgChart({
  persons,
  departments,
  profileAccess,
  selfId,
}: {
  persons: OrgChartPerson[];
  departments: Department[];
  profileAccess: "all" | string[];
  selfId: string | null;
}) {
  const [mode, setMode] = useState<Mode>("reporting");
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [selected, setSelected] = useState<PersonCardData | null>(null);
  const [deptOpen, setDeptOpen] = useState<Department | null>(null);
  const zoomRef = useRef<ReactZoomPanPinchContentRef>(null);

  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const peopleTree = useMemo(() => buildTree(persons, (p) => (p.managerId && byId.has(p.managerId) ? p.managerId : null)), [persons, byId]);
  const deptById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const deptTree = useMemo(() => buildTree(departments, (d) => d.parentId), [departments]);
  const membersByDept = useMemo(() => {
    const m = new Map<string, OrgChartPerson[]>();
    for (const p of persons) if (p.departmentId) m.set(p.departmentId, [...(m.get(p.departmentId) ?? []), p]);
    return m;
  }, [persons]);

  const [collapsedPeople, setCollapsedPeople] = useState(() => initialCollapsed(peopleTree, DEFAULT_DEPTH));
  const [collapsedDepts, setCollapsedDepts] = useState(() => new Set<string>());
  const collapsed = mode === "reporting" ? collapsedPeople : collapsedDepts;
  const setCollapsed = mode === "reporting" ? setCollapsedPeople : setCollapsedDepts;

  const canOpen = (id: string) => profileAccess === "all" || profileAccess.includes(id) || id === selfId;
  const openPerson = (p: OrgChartPerson) =>
    setSelected({
      id: p.id,
      name: p.name,
      title: p.title,
      department: p.department,
      email: p.email,
      hasPhoto: p.photo,
      manager: p.managerId ? (byId.get(p.managerId)?.name ?? null) : null,
      canOpenProfile: canOpen(p.id),
    });

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    if (mode === "reporting") return persons.filter((p) => p.name.toLowerCase().includes(q) || p.title?.toLowerCase().includes(q)).slice(0, 8).map((p) => ({ id: p.id, label: p.name, sub: p.title }));
    return departments.filter((d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)).slice(0, 8).map((d) => ({ id: d.id, label: d.name, sub: d.code }));
  }, [query, mode, persons, departments]);

  const focus = (id: string) => {
    const parentOf = mode === "reporting" ? (x: string) => byId.get(x)?.managerId : (x: string) => deptById.get(x)?.parentId;
    const ancestors = pathToRoot(id, parentOf).slice(0, -1);
    setCollapsed((prev) => {
      const next = new Set(prev);
      ancestors.forEach((a) => next.delete(a));
      return next;
    });
    setHighlight(id);
    setQuery("");
    // Wait for the expanded nodes to render, then pan to the match.
    setTimeout(() => zoomRef.current?.zoomToElement(`org-node-${id}`, 1, 400), 60);
  };

  /** Scale the chart to fit the viewport width (never above 100%) and centre it. */
  const fit = () => {
    const inst = zoomRef.current?.instance;
    const wrapper = inst?.wrapperComponent;
    const content = inst?.contentComponent;
    if (!wrapper || !content) return;
    const scale = inst.transformState.scale || 1;
    const naturalWidth = content.offsetWidth || content.getBoundingClientRect().width / scale;
    const target = Math.max(0.3, Math.min(1, (wrapper.clientWidth - 24) / naturalWidth));
    zoomRef.current?.centerView(target, 200);
  };

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const expandAll = () => {
    setCollapsed(new Set());
    setTimeout(fit, 50);
  };
  const collapseAll = () => {
    setCollapsed(mode === "reporting" ? initialCollapsed(peopleTree, 1) : initialCollapsed(deptTree, 1));
    setTimeout(fit, 50);
  };

  const ToggleButton = ({ id, count }: { id: string; count: number }) =>
    count > 0 ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle(id);
        }}
        className="bg-background hover:bg-accent absolute -bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full border px-1.5 text-[10px] leading-5"
        aria-expanded={!collapsed.has(id)}
        aria-label={collapsed.has(id) ? `Expand (${count})` : "Collapse"}
      >
        {collapsed.has(id) ? <ChevronDown className="size-3" aria-hidden /> : <ChevronUp className="size-3" aria-hidden />}
        {count}
      </button>
    ) : null;

  const renderPerson = (node: TreeNode<OrgChartPerson>): React.ReactNode => {
    const [first, ...rest] = node.name.split(" ");
    return (
      <li key={node.id}>
        <div className="relative pb-3">
          <button
            id={`org-node-${node.id}`}
            type="button"
            onClick={() => openPerson(node)}
            className={cn(
              "bg-card hover:border-primary flex w-48 flex-col items-center gap-1 rounded-xl border p-3 text-center shadow-xs transition-colors",
              highlight === node.id && "ring-primary border-primary ring-2",
              node.id === selfId && "bg-accent",
            )}
          >
            <Avatar employeeId={node.id} hasPhoto={node.photo} firstName={first} lastName={rest.at(-1)} size={40} />
            <span className="w-full truncate text-sm font-medium">{node.name}</span>
            <span className="text-muted-foreground w-full truncate text-xs">{node.title ?? "—"}</span>
            {node.department && <span className="text-muted-foreground w-full truncate text-[10px] uppercase">{node.department}</span>}
          </button>
          <ToggleButton id={node.id} count={node.children.length} />
        </div>
        {node.children.length > 0 && !collapsed.has(node.id) && <ul>{node.children.map(renderPerson)}</ul>}
      </li>
    );
  };

  const renderDept = (node: TreeNode<Department>): React.ReactNode => {
    const head = node.headId ? byId.get(node.headId) : undefined;
    const members = membersByDept.get(node.id)?.length ?? 0;
    return (
      <li key={node.id}>
        <div className="relative pb-3">
          <button
            id={`org-node-${node.id}`}
            type="button"
            onClick={() => setDeptOpen(node)}
            className={cn("bg-card hover:border-primary flex w-52 flex-col items-center gap-1 rounded-xl border p-3 text-center shadow-xs", highlight === node.id && "ring-primary border-primary ring-2")}
          >
            <Building2 className="text-link size-5" aria-hidden />
            <span className="w-full truncate text-sm font-medium">{node.name}</span>
            <span className="text-muted-foreground w-full truncate text-xs">{head ? `Head: ${head.name}` : "No head"}</span>
            <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
              <Users className="size-3" aria-hidden /> {members} {members === 1 ? "person" : "people"} · {node.code}
            </span>
          </button>
          <ToggleButton id={node.id} count={node.children.length} />
        </div>
        {node.children.length > 0 && !collapsed.has(node.id) && <ul>{node.children.map(renderDept)}</ul>}
      </li>
    );
  };

  if (persons.length === 0) {
    return <p className="text-muted-foreground text-sm">No employees to show yet.</p>;
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
        <div className="flex rounded-lg border p-0.5" role="tablist" aria-label="Chart view">
          {(["reporting", "department"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setHighlight(null);
                setTimeout(fit, 50);
              }}
              className={cn("rounded-md px-3 py-1 text-sm", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {m === "reporting" ? "Reporting line" : "Departments"}
            </button>
          ))}
        </div>
        <div className="relative sm:ms-2 sm:w-72">
          <Search className="text-muted-foreground absolute top-2.5 start-2.5 size-4" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && matches[0] && focus(matches[0].id)}
            placeholder={mode === "reporting" ? "Find a person…" : "Find a department…"}
            aria-label="Search the org chart"
            className="ps-8"
          />
          {matches.length > 0 && (
            <ul className="bg-popover absolute top-full z-20 mt-1 w-full overflow-hidden rounded-md border shadow-md" role="listbox">
              {matches.map((m) => (
                <li key={m.id}>
                  <button className="hover:bg-accent w-full px-3 py-2 text-start text-sm" onClick={() => focus(m.id)}>
                    {m.label} <span className="text-muted-foreground text-xs">· {m.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-1 sm:ms-auto">
          <Button variant="outline" size="icon" onClick={() => zoomRef.current?.zoomIn()} aria-label="Zoom in">
            <ZoomIn aria-hidden />
          </Button>
          <Button variant="outline" size="icon" onClick={() => zoomRef.current?.zoomOut()} aria-label="Zoom out">
            <ZoomOut aria-hidden />
          </Button>
          <Button variant="outline" size="icon" onClick={fit} aria-label="Fit to screen">
            <Crosshair aria-hidden />
          </Button>
          <Button variant="outline" size="sm" onClick={expandAll}>
            <Maximize2 aria-hidden /> Expand all
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            <Minimize2 aria-hidden /> Collapse
          </Button>
        </div>
      </div>
      <div className="bg-muted/30 h-[70vh] cursor-grab active:cursor-grabbing">
        <TransformWrapper ref={zoomRef} minScale={0.2} maxScale={2} initialScale={1} limitToBounds={false} centerOnInit onInit={() => setTimeout(fit, 30)} wheel={{ step: 0.08 }} doubleClick={{ disabled: true }}>
          <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
            <div className="orgchart p-10">
              <ul>{mode === "reporting" ? peopleTree.map(renderPerson) : deptTree.map(renderDept)}</ul>
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
      <PersonCardDialog person={selected} onClose={() => setSelected(null)} />
      <Dialog open={!!deptOpen} onOpenChange={(o) => !o && setDeptOpen(null)}>
        <DialogContent>
          {deptOpen && (
            <>
              <DialogHeader>
                <DialogTitle>{deptOpen.name}</DialogTitle>
                <DialogDescription>
                  {deptOpen.code} · {membersByDept.get(deptOpen.id)?.length ?? 0} people
                </DialogDescription>
              </DialogHeader>
              <ul className="max-h-80 divide-y overflow-y-auto">
                {(membersByDept.get(deptOpen.id) ?? []).map((p) => {
                  const [f, ...r] = p.name.split(" ");
                  return (
                    <li key={p.id}>
                      <button
                        className="hover:bg-accent flex w-full items-center gap-3 rounded-md p-2 text-start"
                        onClick={() => {
                          setDeptOpen(null);
                          openPerson(p);
                        }}
                      >
                        <Avatar employeeId={p.id} hasPhoto={p.photo} firstName={f} lastName={r.at(-1)} size={32} />
                        <span>
                          <span className="block text-sm font-medium">
                            {p.name} {deptOpen.headId === p.id && <span className="text-link text-xs">(Head)</span>}
                          </span>
                          <span className="text-muted-foreground block text-xs">{p.title ?? "—"}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {(membersByDept.get(deptOpen.id) ?? []).length === 0 && <li className="text-muted-foreground p-2 text-sm">No one is assigned directly to this department.</li>}
              </ul>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
