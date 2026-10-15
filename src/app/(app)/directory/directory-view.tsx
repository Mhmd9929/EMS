"use client";
import { useState } from "react";
import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PersonCardDialog, type PersonCardData } from "@/components/person-card";
import { hrefWith } from "@/components/data-table/url";
import type { SearchParams } from "@/lib/list-params";
import { cn } from "@/lib/utils";

export function DirectoryView({ people, view, sp, sort, dir }: { people: PersonCardData[]; view: "cards" | "table"; sp: SearchParams; sort: string; dir: string }) {
  const [selected, setSelected] = useState<PersonCardData | null>(null);
  const toggle = (v: "cards" | "table", Icon: typeof List, label: string) => (
    <Link
      href={hrefWith("/directory", sp, { view: v === "cards" ? undefined : v })}
      aria-label={label}
      aria-current={view === v ? "true" : undefined}
      className={cn("rounded-md p-1.5", view === v ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
    >
      <Icon className="size-4" aria-hidden />
    </Link>
  );
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-muted-foreground flex gap-3 text-sm">
          Sort:
          {(["name", "department"] as const).map((s) => (
            <Link key={s} href={hrefWith("/directory", sp, { sort: s, dir: sort === s && dir === "asc" ? "desc" : "asc", page: undefined })} className={cn("capitalize hover:underline", sort === s && "text-foreground font-medium")}>
              {s}
              {sort === s && (dir === "asc" ? " ↑" : " ↓")}
            </Link>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border p-0.5">
          {toggle("cards", LayoutGrid, "Card view")}
          {toggle("table", List, "Table view")}
        </div>
      </div>
      {view === "cards" ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {people.map((p) => (
            <li key={p.id}>
              <button onClick={() => setSelected(p)} className="bg-card hover:bg-accent/50 flex w-full items-center gap-3 rounded-xl border p-4 text-start transition-colors">
                <Avatar employeeId={p.id} hasPhoto={p.hasPhoto} firstName={p.firstName} lastName={p.lastName} size={48} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="text-muted-foreground block truncate text-sm">{p.title ?? "—"}</span>
                  <span className="text-muted-foreground block truncate text-xs">{p.department ?? "—"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Title</TableHead>
                <TableHead className="hidden md:table-cell">Department</TableHead>
                <TableHead className="hidden lg:table-cell">Location</TableHead>
                <TableHead className="hidden lg:table-cell">Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelected(p)}>
                  <TableCell>
                    <button className="flex items-center gap-2 text-start font-medium hover:underline" onClick={() => setSelected(p)}>
                      <Avatar employeeId={p.id} hasPhoto={p.hasPhoto} firstName={p.firstName} lastName={p.lastName} size={28} />
                      {p.name}
                    </button>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{p.title ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{p.department ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{p.location ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{p.email}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <PersonCardDialog person={selected} onClose={() => setSelected(null)} />
    </>
  );
}
