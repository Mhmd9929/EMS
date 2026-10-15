"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { savePayComponentAction } from "@/server/actions/payroll.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox, Input, NativeSelect } from "@/components/ui/input";

type C = { id: string; code: string; name: string; kind: string; calcType: string; formula: string | null; isRecurring: boolean; isTaxable: boolean; isFixedPay: boolean; isActive: boolean; isSystem: boolean };

function Toggle({ name, label, defaultChecked, hint, disabled }: { name: string; label: string; defaultChecked: boolean; hint?: string; disabled?: boolean }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox name={name} defaultChecked={defaultChecked} disabled={disabled} className="mt-0.5" />
      <span>
        {label}
        {hint && <span className="text-muted-foreground block text-xs">{hint}</span>}
      </span>
    </label>
  );
}

export function ComponentDialog({ component, codes }: { component?: C; codes: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {component ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${component.name}`}>
            <Pencil aria-hidden /> Edit
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden /> New component
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">{open && <ComponentForm component={component} codes={codes} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function ComponentForm({ component: c, codes, onDone }: { component?: C; codes: string[]; onDone: () => void }) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(savePayComponentAction);
  useActionFeedback(state, {
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });
  const err = (n: string) => fieldError(state, n);
  const [calcType, setCalcType] = useState(c?.calcType ?? "FIXED");
  const [kind, setKind] = useState(c?.kind ?? "EARNING");
  const system = !!c?.isSystem;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{c ? `Edit ${c.name}` : "New pay component"}</DialogTitle>
        {system && <DialogDescription>System component: code, type and recurrence are fixed.</DialogDescription>}
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError state={state} />
        {c && <input type="hidden" name="id" value={c.id} />}
        {/* Disabled inputs are not submitted: keep system values in hidden fields. */}
        {system && (
          <>
            <input type="hidden" name="code" value={c.code} />
            <input type="hidden" name="kind" value={c.kind} />
            {c.isRecurring && <input type="hidden" name="isRecurring" value="on" />}
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" name="name" error={err("name")} required className="sm:col-span-2">
            <Input defaultValue={c?.name} />
          </Field>
          <Field label="Code" name={system ? "code-display" : "code"} error={err("code")} required hint="Used in formulas">
            <Input defaultValue={c?.code} className="font-mono uppercase" disabled={system} maxLength={30} />
          </Field>
          <Field label="Type" name={system ? "kind-display" : "kind"} error={err("kind")} required>
            <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)} disabled={system}>
              <option value="EARNING">Earning</option>
              <option value="DEDUCTION">Deduction</option>
            </NativeSelect>
          </Field>
          <Field label="Calculation" name="calcType" error={err("calcType")} required className="sm:col-span-2">
            <NativeSelect value={calcType} onChange={(e) => setCalcType(e.target.value)}>
              <option value="FIXED">Fixed amount (entered per employee)</option>
              <option value="FORMULA">Formula</option>
            </NativeSelect>
          </Field>
        </div>
        {calcType === "FORMULA" && (
          <Field label="Formula" name="formula" error={err("formula")} required hint={`Use + − × ÷, brackets, min/max/round/floor/ceil/abs and component codes: ${codes.join(", ")}`}>
            <Input defaultValue={c?.formula ?? ""} className="font-mono" placeholder="BASIC * 0.5" />
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle name={system ? "isRecurring-display" : "isRecurring"} label="Monthly (recurring)" defaultChecked={c?.isRecurring ?? true} disabled={system} hint="Off = one-time, used for adjustments" />
          {kind === "EARNING" && <Toggle name="isFixedPay" label="Fixed pay for WPS" defaultChecked={c?.isFixedPay ?? true} hint="Off = reported as variable pay" />}
          <Toggle name="isTaxable" label="Taxable" defaultChecked={c?.isTaxable ?? false} hint="For reporting; UAE has no personal income tax" />
          <Toggle name="isActive" label="Active" defaultChecked={c?.isActive ?? true} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <SubmitButton pending={pending}>Save</SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}
