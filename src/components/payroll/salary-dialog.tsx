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

export type SalaryComponentOption = { id: string; code: string; name: string; calcType: string; formula: string | null; current: string | null; included: boolean };

/** New salary (effective-dated). Past salaries are never edited; history is append-only. */
export function SalaryDialog({ employeeId, components, defaultDate, currency }: { employeeId: string; components: SalaryComponentOption[]; defaultDate: string; currency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden /> Change salary
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">{open && <SalaryForm employeeId={employeeId} components={components} defaultDate={defaultDate} currency={currency} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function SalaryForm({ employeeId, components, defaultDate, currency, onDone }: { employeeId: string; components: SalaryComponentOption[]; defaultDate: string; currency: string; onDone: () => void }) {
  const router = useRouter();
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
        <DialogTitle>Change salary</DialogTitle>
        <DialogDescription>Applies from the effective date; earlier months keep the previous salary. Mid-month changes are pro-rated.</DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError state={state} />
        <input type="hidden" name="employeeId" value={employeeId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Effective from" name="effectiveFrom" error={fieldError(state, "effectiveFrom")} required>
            <Input type="date" defaultValue={defaultDate} />
          </Field>
          <Field label="Reason" name="reason" error={fieldError(state, "reason")} required>
            <Input placeholder="e.g. Annual increment" maxLength={300} />
          </Field>
        </div>
        <fieldset className="grid gap-2 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Monthly components ({currency})</legend>
          {components.map((c) => (
            <div key={c.id} className="grid grid-cols-[1fr_9rem] items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!included[c.id]} disabled={c.code === "BASIC"} onChange={(e) => setIncluded((s) => ({ ...s, [c.id]: e.target.checked }))} aria-label={`Include ${c.name}`} />
                {c.name}
              </label>
              {included[c.id] && <input type="hidden" name="componentIds" value={c.id} />}
              {c.calcType === "FORMULA" ? (
                <span className="text-muted-foreground font-mono text-xs">{c.formula}</span>
              ) : (
                <Input name={included[c.id] ? "amounts" : undefined} aria-label={`${c.name} amount`} defaultValue={c.current ?? ""} inputMode="decimal" placeholder="0.00" disabled={!included[c.id]} className="text-end" />
              )}
              {included[c.id] && c.calcType === "FORMULA" && <input type="hidden" name="amounts" value="" />}
            </div>
          ))}
          {fieldError(state, "amounts") && <p className="text-destructive text-xs">{fieldError(state, "amounts")}</p>}
        </fieldset>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <SubmitButton pending={pending}>Save salary</SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}

export function DeleteSalaryButton({ structureId, employeeId, label }: { structureId: string; employeeId: string; label: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm" aria-label={`Delete scheduled salary from ${label}`}>
          <Trash2 aria-hidden />
        </Button>
      }
      title="Delete this scheduled salary change?"
      description={`The change from ${label} has not started yet.`}
      confirmLabel="Delete"
      destructive
      action={() => deleteSalaryAction(structureId, employeeId)}
      onDone={() => router.refresh()}
    />
  );
}
