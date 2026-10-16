/**
 * Display-time translation of what the calculation stores in the database (issues JSON and line notes).
 * Both are written once, at calculation time, so they are translated when shown:
 *   - issues carry a `code` + `params` (payroll.issues.<code>); older rows without a code show `message`;
 *   - line notes are plain English strings; the engine's known patterns are recognised and translated
 *     (payroll.notes.<key>), anything else (e.g. an adjustment description typed by HR) is shown as entered;
 *   - a run's scope label ("All employees", "Department: Finance") is rebuilt from its scope.
 */
import type { CalcIssue } from "./calc";

/** A next-intl translator bound to the "payroll" namespace (typed loosely so any typed translator fits). */
export type PayrollTranslator = ((key: never, values?: never) => string) & { has: (key: never) => boolean };
type LooseT = ((key: string, values?: Record<string, string | number>) => string) & { has: (key: string) => boolean };

export function issueText(issue: CalcIssue, t: PayrollTranslator): string {
  const tr = t as unknown as LooseT;
  if (issue.code) {
    const key = `issues.${issue.code}`;
    if (tr.has(key)) return tr(key, issue.params ?? {});
  }
  return issue.message;
}

export type LineNote = { key: "prorated" | "salaryChange" | "unpaidLeave"; params: Record<string, string | number> };

const NOTE_PATTERNS: [RegExp, (m: RegExpExecArray) => LineNote][] = [
  [/^Pro-rated (\d+(?:\.\d+)?)\/(\d+) days$/, (m) => ({ key: "prorated", params: { paid: Number(m[1]), basis: Number(m[2]) } })],
  [
    /^Salary change on (\d{4}-\d{2}-\d{2}); (\d+(?:\.\d+)?)\/(\d+) days$/,
    (m) => ({ key: "salaryChange", params: { date: m[1], paid: Number(m[2]), basis: Number(m[3]) } }),
  ],
  [/^(\d+(?:\.\d+)?) days? × daily rate \((\d+)-day basis\)$/, (m) => ({ key: "unpaidLeave", params: { days: Number(m[1]), basis: Number(m[2]) } })],
];

/** Recognise a note written by the calculation engine (see calc.ts); null for anything else. */
export function parseLineNote(note: string | null | undefined): LineNote | null {
  if (!note) return null;
  for (const [re, build] of NOTE_PATTERNS) {
    const m = re.exec(note);
    if (m) return build(m);
  }
  return null;
}

export function lineNoteText(note: string | null | undefined, t: PayrollTranslator): string | null {
  if (!note) return null;
  const parsed = parseLineNote(note);
  if (!parsed) return note;
  return (t as unknown as LooseT)(`notes.${parsed.key}`, parsed.params);
}

/** A run's scope for display, e.g. "Department: Finance" (the stored scopeLabel is English). */
export function runScopeText(run: { scope: string; scopeLabel: string }, t: PayrollTranslator): string {
  const tr = t as unknown as LooseT;
  if (run.scope === "ALL") return tr("scope.all");
  const name = run.scopeLabel.replace(/^(Department|Location): /, "");
  return tr(run.scope === "DEPARTMENT" ? "scope.department" : "scope.location", { name });
}
