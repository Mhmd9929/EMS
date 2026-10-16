"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useTranslations("admin.audit");
  const set = (key: "from" | "to", value: string) => {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    sp.delete("page");
    router.replace(`${pathname}?${sp}`, { scroll: false });
  };
  return (
    <div className="flex items-center gap-1">
      <Input type="date" aria-label={t("fromDate")} value={params.get("from") ?? ""} onChange={(e) => set("from", e.target.value)} className="w-auto" />
      <span className="text-muted-foreground text-sm">–</span>
      <Input type="date" aria-label={t("toDate")} value={params.get("to") ?? ""} onChange={(e) => set("to", e.target.value)} className="w-auto" />
    </div>
  );
}
