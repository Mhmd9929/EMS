"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, CalendarCheck, Info, Loader2, Paperclip, Users } from "lucide-react";
import { applyLeaveAction, previewLeaveAction } from "@/server/actions/leave.actions";
import type { LeaveEvaluation } from "@/server/services/leave/request.service";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { parseDateOnly } from "@/lib/dates";
import { useTranslations } from "next-intl";
import { useFormat } from "@/components/i18n/use-format";

type TypeOption = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  allowHalfDay: boolean;
  minNoticeDays: number;
  requiresAttachmentAfterDays: number | null;
  isPaid: boolean;
  eligible: boolean;
  reason: string | null;
};

export function ApplyLeaveForm({ types, today }: { types: TypeOption[]; today: string }) {
  const t = useTranslations("leave.apply");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const f = useFormat();
  const d = (s: string) => f.date(parseDateOnly(s));
  const firstEligible = types.find((o) => o.eligible)?.id ?? "";
  const [leaveTypeId, setLeaveTypeId] = useState(firstEligible);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [halfDay, setHalfDay] = useState("NONE");
  const [preview, setPreview] = useState<LeaveEvaluation | null>(null);
  const [previewing, startPreview] = useTransition();
  const { state, onSubmit, pending } = useFormAction(applyLeaveAction);
  useActionFeedback(state, { silentSuccess: true });

  const type = types.find((o) => o.id === leaveTypeId);
  const singleDay = !!startDate && startDate === endDate;

  // Keep end date >= start date for convenience.
  useEffect(() => {
    if (startDate && (!endDate || endDate < startDate)) setEndDate(startDate);
  }, [startDate, endDate]);
  useEffect(() => {
    if (!singleDay || !type?.allowHalfDay) setHalfDay("NONE");
  }, [singleDay, type?.allowHalfDay]);

  // Debounced live calculation.
  useEffect(() => {
    if (!leaveTypeId || !startDate || !endDate) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      startPreview(async () => {
        const r = await previewLeaveAction({ leaveTypeId, startDate, endDate, halfDay });
        setPreview(r.ok ? (r.data ?? null) : null);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [leaveTypeId, startDate, endDate, halfDay]);

  const blocking = useMemo(() => !preview || !preview.ok, [preview]);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <form onSubmit={onSubmit} className="grid gap-4 lg:col-span-3" encType="multipart/form-data">
        <FormError state={state} />
        {state && !state.ok && state.fieldErrors?._form && state.fieldErrors._form.length > 1 && (
          <ul className="text-destructive list-disc ps-5 text-sm">
            {state.fieldErrors._form.slice(1).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <Card>
          <CardContent className="grid gap-4">
            <Field label={t("leaveType")} name="leaveTypeId" error={fieldError(state, "leaveTypeId")} required>
              <NativeSelect value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
                <option value="" disabled>
                  {t("choose")}
                </option>
                {types.map((o) => (
                  <option key={o.id} value={o.id} disabled={!o.eligible}>
                    {o.name}
                    {!o.isPaid ? t("unpaidSuffix") : ""}
                    {!o.eligible ? t("ineligibleSuffix", { reason: o.reason ?? "" }) : ""}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {type?.description && <p className="text-muted-foreground -mt-2 text-xs">{type.description}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("firstDay")} name="startDate" error={fieldError(state, "startDate")} required>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label={t("lastDay")} name="endDate" error={fieldError(state, "endDate")} required>
                <Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            </div>
            {type?.allowHalfDay && singleDay && (
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">{t("duration")}</legend>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["NONE", t("fullDay")],
                    ["FIRST_HALF", t("morningHalf")],
                    ["SECOND_HALF", t("afternoonHalf")],
                  ].map(([value, label]) => (
                    <label key={value} className="has-[:checked]:border-primary has-[:checked]:bg-primary/10 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                      <input type="radio" name="halfDay" value={value} checked={halfDay === value} onChange={() => setHalfDay(value)} className="accent-primary" />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {!(type?.allowHalfDay && singleDay) && <input type="hidden" name="halfDay" value="NONE" />}
            <Field label={tc("reason")} name="reason" error={fieldError(state, "reason")} hint={t("reasonHint")}>
              <Textarea rows={3} maxLength={1000} />
            </Field>
            <div className="grid gap-1.5">
              <label htmlFor="attachment" className="flex items-center gap-2 text-sm font-medium">
                <Paperclip className="size-4" aria-hidden /> {t("supportingDocument")} {preview?.attachmentRequired && <span className="text-destructive">*</span>}
              </label>
              <input
                id="attachment"
                name="attachment"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="text-muted-foreground file:bg-secondary file:text-foreground text-sm file:me-2 file:rounded-md file:border-0 file:px-3 file:py-1.5"
              />
              <p className="text-muted-foreground text-xs">{preview?.attachmentRequired ? t("fileHintRequired") : t("fileHint")}</p>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Link href="/leave" className={buttonVariants({ variant: "outline" })}>
            {tc("cancel")}
          </Link>
          <SubmitButton pending={pending} disabled={blocking || previewing} pendingText={t("submitting")}>
            {t("submit")}
          </SubmitButton>
        </div>
      </form>

      <aside className="lg:col-span-2" aria-live="polite">
        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="size-4" aria-hidden /> {t("summary")}
              {previewing && <Loader2 className="text-muted-foreground size-4 animate-spin" aria-label={t("calculating")} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!preview && <p className="text-muted-foreground">{t("summaryEmpty")}</p>}
            {preview?.count && (
              <div>
                <p className="text-3xl font-semibold tabular-nums">{tc("days", { count: preview.count.total })}</p>
                {Object.keys(preview.count.byYear).length > 1 && (
                  <p className="text-muted-foreground">
                    {t("splitAcrossYears", { list: Object.entries(preview.count.byYear).map(([y, n]) => `${y}: ${n}`).join(" · ") })}
                  </p>
                )}
                {preview.count.skipped.length > 0 && (
                  <p className="text-muted-foreground text-xs">
                    {t("notCountedWeekends", { count: preview.count.skipped.filter((s) => s.reason === "weekend").length })}
                    {preview.count.skipped.some((s) => s.reason === "holiday") && t("notCountedHolidays", { count: preview.count.skipped.filter((s) => s.reason === "holiday").length })}
                  </p>
                )}
              </div>
            )}
            {preview?.balances.filter((b) => b.tracked).map((b) => (
              <div key={b.year} className="rounded-lg border p-3">
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">{t("balanceYear", { year: String(b.year) })}</p>
                <dl className="grid grid-cols-2 gap-y-1 tabular-nums">
                  <dt>{t("availableNow")}</dt>
                  <dd className="text-end">{b.available}</dd>
                  {b.projected > 0 && (
                    <>
                      <dt>{t("projected")}</dt>
                      <dd className="text-end">+{b.projected}</dd>
                    </>
                  )}
                  <dt>{t("thisRequest")}</dt>
                  <dd className="text-end">−{b.requested}</dd>
                  <dt className="font-medium">{t("remainingAfter")}</dt>
                  <dd className={`text-end font-semibold ${b.after < 0 ? "text-destructive" : ""}`}>{b.after}</dd>
                </dl>
              </div>
            ))}
            {preview?.errors.map((e) => (
              <p key={e} className="text-destructive flex gap-2" role="alert">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {e}
              </p>
            ))}
            {preview?.warnings.map((w) => (
              <p key={w} className="flex gap-2 text-warning">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                {w}
              </p>
            ))}
            {preview && preview.teammatesOff.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-2 font-medium">
                  <Users className="size-4" aria-hidden /> {t("alsoOff")}
                </p>
                <ul className="text-muted-foreground space-y-0.5 text-xs">
                  {preview.teammatesOff.map((m) => (
                    <li key={`${m.name}-${m.from}`}>
                      {m.name}: {d(m.from)}
                      {m.to !== m.from && ` – ${d(m.to)}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {preview && (
              <p className="text-muted-foreground text-xs">
                {t("approval")}{" "}
                {preview.approvalSteps.length ? (
                  preview.approvalSteps.map((s, i) => (
                    <Badge key={s} variant="outline" className="me-1">
                      {i + 1}. {te(`approvalRole.${s === "MANAGER" ? "MANAGER" : "HR"}`)}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="success">{t("automatic")}</Badge>
                )}
              </p>
            )}
            {type && type.minNoticeDays > 0 && <p className="text-muted-foreground text-xs">{t("noticeNote", { type: type.name, days: type.minNoticeDays, today: d(today) })}</p>}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
