/** Parse URL search params for list pages: pagination, search, sorting and filters. */
export type SearchParams = Record<string, string | string[] | undefined>;

export type ListParams<S extends string> = {
  page: number;
  pageSize: number;
  q: string;
  sort: S;
  dir: "asc" | "desc";
};

export const PAGE_SIZES = [10, 20, 50, 100] as const;

export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseListParams<S extends string>(
  sp: SearchParams,
  opts: { sortable: readonly S[]; defaultSort: S; defaultDir?: "asc" | "desc"; defaultPageSize?: number },
): ListParams<S> {
  const page = Math.max(1, Number.parseInt(first(sp.page) ?? "1", 10) || 1);
  const sizeRaw = Number.parseInt(first(sp.pageSize) ?? "", 10);
  const pageSize = (PAGE_SIZES as readonly number[]).includes(sizeRaw) ? sizeRaw : (opts.defaultPageSize ?? 20);
  const q = (first(sp.q) ?? "").trim().slice(0, 100);
  const sortRaw = first(sp.sort) as S | undefined;
  const sort = sortRaw && opts.sortable.includes(sortRaw) ? sortRaw : opts.defaultSort;
  const dirRaw = first(sp.dir);
  const dir = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : (opts.defaultDir ?? "asc");
  return { page, pageSize, q, sort, dir };
}

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number; pageCount: number };

export function paginated<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
