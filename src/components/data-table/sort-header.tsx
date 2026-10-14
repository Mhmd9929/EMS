import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import type { SearchParams } from "@/lib/list-params";
import { hrefWith } from "./url";
import { cn } from "@/lib/utils";

export function SortHeader({
  label,
  sortKey,
  current,
  dir,
  pathname,
  searchParams,
  className,
}: {
  label: string;
  sortKey: string;
  current: string;
  dir: "asc" | "desc";
  pathname: string;
  searchParams: SearchParams;
  className?: string;
}) {
  const active = current === sortKey;
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className={className} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link
        href={hrefWith(pathname, searchParams, { sort: sortKey, dir: nextDir, page: undefined })}
        className={cn("hover:text-foreground inline-flex items-center gap-1", active && "text-foreground")}
      >
        {label}
        <Icon className="size-3.5" aria-hidden />
      </Link>
    </TableHead>
  );
}
