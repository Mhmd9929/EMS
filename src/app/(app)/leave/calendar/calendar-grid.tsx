import Link from "next/link";
import type { CalendarCell } from "@/server/services/leave/calendar.service";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { createFormat } from "@/lib/format";
import { isLocale } from "@/i18n/config";

type Row = { id: string; name: string; department: string | null; cells: Record<string, CalendarCell>; total: number };

const pad = (n: number) => String(n).padStart(2, "0");

/** Month grid: employees × days. Server-rendered; cells link to the request when visible. */
export function CalendarGrid({
  year,
  month,
  today,
  workWeek,
  holidays,
  rows,
  linkable,
}: {
  year: number;
  month: number;
  today: string;
  workWeek: number[];
  holidays: { date: string; name: string }[];
  rows: Row[];
  linkable: boolean;
}) {
  const t = useTranslations("leave.calendar");
  const tc = useTranslations("common");
  const tl = useTranslations("leave");
  const tStatus = useTranslations("enums.leaveStatus");
  const locale = useLocale();
  const f = createFormat(isLocale(locale) ? locale : "en");
  // Column headers: two-letter English abbreviations ("Mo"), narrow Arabic names (short ones are full words).
  const dowLabel = (d: Date) =>
    f.locale === "en" ? f.weekday(d).slice(0, 2) : new Intl.DateTimeFormat(f.intl, { weekday: "narrow", timeZone: "UTC" }).format(d);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${year}-${pad(month + 1)}-${pad(i + 1)}`;
    const utc = new Date(Date.UTC(year, month, i + 1));
    const dow = ((utc.getUTCDay() + 6) % 7) + 1;
    const holiday = holidays.find((h) => h.date === date);
    return { date, day: i + 1, dow, dowLabel: dowLabel(utc), weekend: !workWeek.includes(dow), holiday };
  });
  const legend = new Map<string, string>();
  rows.forEach((r) => Object.values(r.cells).forEach((c) => legend.set(c.label, c.color)));
  const offToday = rows.filter((r) => r.cells[today]?.status === "APPROVED").length;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th scope="col" className="bg-muted/50 sticky start-0 z-10 min-w-44 border-e px-3 py-2 text-start font-medium">
                {tc("employee")}
              </th>
              {days.map((d) => (
                <th
                  key={d.date}
                  scope="col"
                  title={d.holiday?.name}
                  className={cn("w-8 min-w-8 px-0 py-1 text-center font-medium", (d.weekend || d.holiday) && "bg-muted text-muted-foreground", d.date === today && "text-link")}
                >
                  <div className="text-[10px] font-normal">{d.dowLabel}</div>
                  <div className={cn(d.date === today && "bg-primary text-primary-foreground mx-auto w-5 rounded-full")}>{d.day}</div>
                </th>
              ))}
              <th scope="col" className="px-2 text-end font-medium">
                {tl("columns.days")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <th scope="row" className="bg-background sticky start-0 z-10 border-e px-3 py-1.5 text-start font-normal">
                  <span className="block truncate font-medium">{r.name}</span>
                  {r.department && <span className="text-muted-foreground block truncate text-[10px]">{r.department}</span>}
                </th>
                {days.map((d) => {
                  const c = r.cells[d.date];
                  const shade = d.weekend || d.holiday ? "bg-muted/60" : "";
                  if (!c) return <td key={d.date} className={cn("h-9 border-s border-border/40", shade)} />;
                  const style =
                    c.status === "PENDING"
                      ? { backgroundImage: `repeating-linear-gradient(45deg, ${c.color}55 0 4px, transparent 4px 8px)`, border: `1px solid ${c.color}` }
                      : { backgroundColor: c.color };
                  const title = `${t("cellTitle", { name: r.name, label: c.label })}${c.status === "PENDING" ? t("cellPending") : ""}${c.amount < 1 ? t("cellHalfDay") : ""}`;
                  const block = <span className={cn("block h-6 rounded-sm", c.amount < 1 && "h-3")} style={style} title={title} />;
                  return (
                    <td key={d.date} className={cn("h-9 border-s border-border/40 px-0.5", shade)}>
                      {linkable && c.requestId ? (
                        <Link href={`/leave/requests/${c.requestId}`} aria-label={title}>
                          {block}
                        </Link>
                      ) : (
                        <span aria-label={title}>{block}</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 text-end tabular-nums">{r.total || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span>{t("offToday", { count: offToday })}</span>
        {[...legend.entries()].map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ backgroundColor: color }} aria-hidden /> {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="border-muted-foreground size-3 rounded-sm border" style={{ backgroundImage: "repeating-linear-gradient(45deg, color-mix(in srgb, var(--muted-foreground) 35%, transparent) 0 3px, transparent 3px 6px)" }} aria-hidden /> {tStatus("PENDING")}
        </span>
        {holidays.length > 0 && <span>{t("holidays", { list: holidays.map((h) => `${Number(h.date.slice(8))} ${h.name}`).join(f.locale === "ar" ? "، " : ", ") })}</span>}
      </div>
    </div>
  );
}
