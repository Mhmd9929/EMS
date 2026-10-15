"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PAGE_SIZES } from "@/lib/list-params";

export function useUpdateParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const update = (updates: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page");
    start(() => router.replace(sp.toString() ? `${pathname}?${sp}` : pathname, { scroll: false }));
  };
  return { update, params, pending };
}

/** Debounced search box bound to the `q` URL param. */
export function SearchInput({ placeholder = "Search…", param = "q" }: { placeholder?: string; param?: string }) {
  const { update, params, pending } = useUpdateParams();
  const initial = params.get(param) ?? "";
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  useEffect(() => {
    if (value === initial) return;
    const t = setTimeout(() => update({ [param]: value.trim() || undefined }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative w-full sm:max-w-xs">
      {pending ? (
        <Loader2 className="text-muted-foreground absolute top-2.5 start-2.5 size-4 animate-spin" aria-hidden />
      ) : (
        <Search className="text-muted-foreground absolute top-2.5 start-2.5 size-4" aria-hidden />
      )}
      <Input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="ps-8"
      />
    </div>
  );
}

/** `defaultValue` (e.g. the current year) replaces the "All" option for filters that always apply. */
export function FilterSelect({ param, label, options, defaultValue }: { param: string; label: string; options: { value: string; label: string }[]; defaultValue?: string }) {
  const { update, params } = useUpdateParams();
  return (
    <NativeSelect aria-label={label} value={params.get(param) ?? defaultValue ?? ""} onChange={(e) => update({ [param]: e.target.value || undefined })} className="w-full sm:w-auto">
      {defaultValue === undefined && <option value="">{label}: All</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}

export function ClearFilters({ params: keys }: { params: string[] }) {
  const { update, params } = useUpdateParams();
  if (!keys.some((k) => params.get(k))) return null;
  return (
    <Button variant="ghost" size="sm" onClick={() => update(Object.fromEntries(keys.map((k) => [k, undefined])))}>
      <X aria-hidden /> Clear
    </Button>
  );
}

export function PageSizeSelect({ value }: { value: number }) {
  const { update } = useUpdateParams();
  return (
    <NativeSelect aria-label="Rows per page" value={String(value)} onChange={(e) => update({ pageSize: e.target.value })} className="h-8 w-auto">
      {PAGE_SIZES.map((s) => (
        <option key={s} value={s}>
          {s} / page
        </option>
      ))}
    </NativeSelect>
  );
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex flex-col flex-wrap gap-2 sm:flex-row sm:items-center">{children}</div>;
}
