import "server-only";
import ExcelJS from "exceljs";
import { brand } from "@/theme/brand";
import Papa from "papaparse";

/** Neutralise spreadsheet formula injection in user-controlled text. */
export const safeCell = (v: unknown) => (typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

export type Sheet = { name: string; columns: { header: string; key: string; width?: number; numFmt?: string }[]; rows: Record<string, unknown>[] };

export async function xlsxResponse(filename: string, sheets: Sheet[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = brand.name;
  wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    ws.columns = s.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? Math.max(12, c.header.length + 2), style: c.numFmt ? { numFmt: c.numFmt } : undefined }));
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    for (const r of s.rows) ws.addRow(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safeCell(v)])));
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.columns.length } };
  }
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

export function csvResponse(filename: string, sheet: Sheet) {
  const csv = Papa.unparse({
    fields: sheet.columns.map((c) => c.header),
    data: sheet.rows.map((r) => sheet.columns.map((c) => safeCell(r[c.key] ?? ""))),
  });
  return new Response(`﻿${csv}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.csv"`, "Cache-Control": "no-store" },
  });
}
