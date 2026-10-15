import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDate, isoWeekday, parseDateOnly, todayInTimeZone, toDateInput, yearsBetween } from "@/lib/dates";

describe("date-only helpers", () => {
  it("parses ISO dates at UTC midnight", () => {
    expect(parseDateOnly("2026-03-01")?.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("rejects impossible or malformed dates", () => {
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("2026-13-01")).toBeNull();
    expect(parseDateOnly("01/03/2026")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
  });

  it("accepts leap days only in leap years", () => {
    expect(parseDateOnly("2028-02-29")).not.toBeNull();
    expect(parseDateOnly("2026-02-29")).toBeNull();
  });

  it("round-trips through <input type=date>", () => {
    expect(toDateInput(parseDateOnly("2025-12-31"))).toBe("2025-12-31");
    expect(toDateInput(null)).toBe("");
  });

  it("formats calendar dates in UTC so they never shift", () => {
    expect(formatDate(parseDateOnly("2026-01-01"))).toBe("01 Jan 2026");
  });

  it("computes 'today' in the company timezone", () => {
    // 21:30 UTC on 31 Dec is already 1 Jan in Dubai (UTC+4)
    const instant = new Date("2025-12-31T21:30:00Z");
    expect(toDateInput(todayInTimeZone("Asia/Dubai", instant))).toBe("2026-01-01");
    expect(toDateInput(todayInTimeZone("UTC", instant))).toBe("2025-12-31");
  });

  it("counts days and completed years", () => {
    const a = parseDateOnly("2024-02-28")!;
    expect(daysBetween(a, addDays(a, 2))).toBe(2);
    expect(toDateInput(addDays(a, 1))).toBe("2024-02-29");
    expect(yearsBetween(parseDateOnly("2020-06-15")!, parseDateOnly("2026-06-14")!)).toBe(5);
    expect(yearsBetween(parseDateOnly("2020-06-15")!, parseDateOnly("2026-06-15")!)).toBe(6);
  });

  it("returns ISO weekdays (Mon=1 … Sun=7)", () => {
    expect(isoWeekday(parseDateOnly("2026-10-12")!)).toBe(1); // Monday
    expect(isoWeekday(parseDateOnly("2026-10-18")!)).toBe(7); // Sunday
  });
});
