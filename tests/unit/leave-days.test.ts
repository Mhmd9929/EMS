import { describe, expect, it } from "vitest";
import { countLeaveDays, rangesOverlap } from "@/lib/leave/days";
import { parseDateOnly as d, toDateInput } from "@/lib/dates";

const MON_FRI = [1, 2, 3, 4, 5];
const base = { workWeek: MON_FRI, holidays: new Set<string>(), countWeekends: false, countHolidays: false };

describe("countLeaveDays", () => {
  it("counts a working week Mon–Fri as 5 days", () => {
    const r = countLeaveDays({ ...base, start: d("2026-10-12")!, end: d("2026-10-16")! });
    expect(r.total).toBe(5);
  });

  it("excludes weekends inside the range", () => {
    // Thu 15 Oct → Tue 20 Oct = Thu, Fri, Mon, Tue
    const r = countLeaveDays({ ...base, start: d("2026-10-15")!, end: d("2026-10-20")! });
    expect(r.total).toBe(4);
    expect(r.skipped.filter((s) => s.reason === "weekend")).toHaveLength(2);
  });

  it("returns 0 for a weekend-only request", () => {
    expect(countLeaveDays({ ...base, start: d("2026-10-17")!, end: d("2026-10-18")! }).total).toBe(0);
  });

  it("respects a custom work week (Sat–Thu, Friday off)", () => {
    const r = countLeaveDays({ ...base, workWeek: [1, 2, 3, 4, 6, 7], start: d("2026-10-12")!, end: d("2026-10-18")! });
    expect(r.total).toBe(6);
  });

  it("excludes public holidays unless the type counts them", () => {
    const holidays = new Set(["2026-12-01", "2026-12-02", "2026-12-03"]);
    const range = { start: d("2026-11-30")!, end: d("2026-12-04")! }; // Mon–Fri
    expect(countLeaveDays({ ...base, holidays, ...range }).total).toBe(2);
    expect(countLeaveDays({ ...base, holidays, countHolidays: true, ...range }).total).toBe(5);
  });

  it("counts calendar days when weekends and holidays count (e.g. maternity)", () => {
    const holidays = new Set(["2026-12-02"]);
    const r = countLeaveDays({ ...base, holidays, countWeekends: true, countHolidays: true, start: d("2026-11-01")!, end: d("2026-12-30")! });
    expect(r.total).toBe(60);
  });

  it("does not double-skip a holiday on a weekend", () => {
    const holidays = new Set(["2026-10-17"]); // Saturday
    const r = countLeaveDays({ ...base, holidays, start: d("2026-10-16")!, end: d("2026-10-19")! });
    expect(r.total).toBe(2);
    expect(r.skipped).toHaveLength(2);
  });

  it("supports half days on a single working day", () => {
    expect(countLeaveDays({ ...base, halfDay: "FIRST_HALF", start: d("2026-10-14")!, end: d("2026-10-14")! }).total).toBe(0.5);
    expect(countLeaveDays({ ...base, halfDay: "SECOND_HALF", start: d("2026-10-17")!, end: d("2026-10-17")! }).total).toBe(0); // Saturday
  });

  it("rejects half days on multi-day ranges and reversed ranges", () => {
    expect(() => countLeaveDays({ ...base, halfDay: "FIRST_HALF", start: d("2026-10-14")!, end: d("2026-10-15")! })).toThrow();
    expect(() => countLeaveDays({ ...base, start: d("2026-10-15")!, end: d("2026-10-14")! })).toThrow();
  });

  it("splits requests across leave years", () => {
    // Mon 28 Dec 2026 → Fri 8 Jan 2027, New Year's Day a holiday
    const r = countLeaveDays({ ...base, holidays: new Set(["2027-01-01"]), start: d("2026-12-28")!, end: d("2027-01-08")! });
    expect(r.byYear).toEqual({ 2026: 4, 2027: 5 });
    expect(r.total).toBe(9);
    expect(toDateInput(r.days[0].date)).toBe("2026-12-28");
  });

  it("handles leap days", () => {
    const r = countLeaveDays({ ...base, countWeekends: true, start: d("2028-02-28")!, end: d("2028-03-01")! });
    expect(r.total).toBe(3);
  });
});

describe("rangesOverlap", () => {
  it("detects inclusive overlaps", () => {
    expect(rangesOverlap(d("2026-10-01")!, d("2026-10-05")!, d("2026-10-05")!, d("2026-10-09")!)).toBe(true);
    expect(rangesOverlap(d("2026-10-01")!, d("2026-10-05")!, d("2026-10-06")!, d("2026-10-09")!)).toBe(false);
  });
});
