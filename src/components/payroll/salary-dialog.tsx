"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { deleteSalaryAction, saveSalaryAction } from "@/server/actions/payroll.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox, Input } from "@/components/ui/input";
import { ConfirmAction } from "@/components/confirm-action";
import { useTranslations } from "next-intl";

export type SalaryComponentOption = { id: string; code: string; name: string; calcType: string; formula: string | null; current: string | null; included: boolean };

/** New salary (effective-dated). Past salaries are never edited; history is append-only. */
export function SalaryDialog({ employeeId, components, defaultDate, currency }: { employeeId: string; components: SalaryComponentOption[]; defaultDate: string; currency: string }) {
  const t = useTranslations("payroll.salaryDialog");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden /> {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">{open && <SalaryForm employeeId={employeeId} components={components} defaultDate={defaultDate} currency={currency} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function SalaryForm({ employeeId, components, defaultDate, currency, onDone }: { employeeId: string; components: SalaryComponentOption[]; defaultDate: string; currency: string; onDone: () => void }) {
  const router = useRouter();
  const t = useTranslations("payroll.salaryDialog");
  const tc = useTranslations("common");
  const { state, onSubmit, pending } = useFormAction(saveSalaryAction);
  useActionFeedback(state, {
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });
  const [included, setIncluded] = useState<Record<string, boolean>>(() => Object.fromEntries(components.map((c) => [c.id, c.included || c.code === "BASIC"])));
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError state={state} />
        <input type="hidden" name="employeeId" value={employeeId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("effectiveFrom")} name="effectiveFrom" error={fieldError(state, "effectiveFrom")} required>
            <Input type="date" defaultValue={defaultDate} />
          </Field>
          <Field label={t("reason")} name="reason" error={fieldError(state, "reason")} required>
            <Input placeholder={t("reasonPlaceholder")} maxLength={300} />
          </Field>
        </div>
        <fieldset className="grid gap-2 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">{t("components", { currency })}</legend>
          {components.map((c) => (
            <div key={c.id} className="grid grid-cols-[1fr_9rem] items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!included[c.id]} disabled={c.code === "BASIC"} onChange={(e) => setIncluded((s) => ({ ...s, [c.id]: e.target.checked }))} aria-label={t("include", { name: c.name })} />
                {c.name}
              </label>
              {included[c.id] && <input type="hidden" name="componentIds" value={c.id} />}
              {c.calcType === "FORMULA" ? (
                <span className="text-muted-foreground font-mono text-xs" dir="ltr">{c.formula}</span>
              ) : (
                <Input name={included[c.id] ? "amounts" : undefined} aria-label={t("amountOf", { name: c.name })} defaultValue={c.current ?? ""} inputMode="decimal" placeholder="0.00" disabled={!included[c.id]} className="text-end" />
              )}
              {included[c.id] && c.calcType === "FORMULA" && <input type="hidden" name="amounts" value="" />}
            </div>
          ))}
          {fieldError(state, "amounts") && <p className="text-destructive text-xs">{fieldError(state, "amounts")}</p>}
        </fieldset>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {tc("cancel")}
          </Button>
          <SubmitButton pending={pending}>{t("save")}</SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}

export function DeleteSalaryButton({ structureId, employeeId, label }: { structureId: string; employeeId: string; label: string }) {
  const router = useRouter();
  const t = useTranslations("payroll.salaryDialog");
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm" aria-label={t("deleteLabel", { date: label })}>
          <Trash2 aria-hidden />
        </Button>
      }
      title={t("deleteTitle")}
      description={t("deleteDescription", { date: label })}
      confirmLabel={t("deleteConfirm")}
      destructive
      action={() => deleteSalaryAction(structureId, employeeId)}
      onDone={() => router.refresh()}
    />
  );
}
