"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { saveLeaveTypeAction } from "@/server/actions/leave.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";

type T = {
  id: string; name: string; code: string; description: string | null; color: string; isPaid: boolean; annualEntitlement: number;
  accrualMethod: string; accrualStartAfterMonths: number; prorateUpfront: boolean; carryForwardMax: number; carryForwardExpiryMonths: number | null;
  maxConsecutiveDays: number | null; requiresAttachmentAfterDays: number | null; minNoticeDays: number; allowHalfDay: boolean;
  allowNegativeBalance: boolean; genderEligibility: string | null; countWeekends: boolean; countHolidays: boolean; approvalChain: string[]; isActive: boolean;
};

function Toggle({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox name={name} defaultChecked={defaultChecked} className="mt-0.5" />
      <span>
        {label}
        {hint && <span className="text-muted-foreground block text-xs">{hint}</span>}
      </span>
    </label>
  );
}

export function LeaveTypeDialog({ type }: { type?: T }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {type ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${type.name}`}>
            <Pencil aria-hidden /> Edit
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden /> New leave type
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">{open && <TypeForm type={type} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function TypeForm({ type, onDone }: { type?: T; onDone: () => void }) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(saveLeaveTypeAction);
  useActionFeedback(state, {
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });
  const err = (n: string) => fieldError(state, n);
  const [method, setMethod] = useState(type?.accrualMethod ?? "UPFRONT");
  const chain = type?.approvalChain ?? ["MANAGER"];
  return (
    <>
      <DialogHeader>
        <DialogTitle>{type ? `Edit ${type.name}` : "New leave type"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-5">
        <FormError state={state} />
        {type && <input type="hidden" name="id" value={type.id} />}
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Name" name="name" error={err("name")} required className="sm:col-span-2">
            <Input defaultValue={type?.name} />
          </Field>
          <Field label="Code" name="code" error={err("code")} required>
            <Input defaultValue={type?.code} className="uppercase" maxLength={10} />
          </Field>
          <Field label="Colour" name="color" error={err("color")}>
            <Input type="color" defaultValue={type?.color ?? "#0d9488"} className="h-9 p-1" />
          </Field>
          <Field label="Description" name="description" error={err("description")} className="sm:col-span-4">
            <Textarea rows={2} defaultValue={type?.description ?? ""} />
          </Field>
        </div>

        <fieldset className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
          <legend className="px-1 text-sm font-semibold">Entitlement</legend>
          <Field label="Accrual method" name="accrualMethod" error={err("accrualMethod")}>
            <NativeSelect value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="UPFRONT">Yearly, credited up front</option>
              <option value="MONTHLY">Monthly accrual (÷ 12)</option>
              <option value="NONE">No balance (e.g. unpaid)</option>
            </NativeSelect>
          </Field>
          <Field label="Days per year" name="annualEntitlement" error={err("annualEntitlement")}>
            <Input type="number" step="0.5" min={0} max={366} defaultValue={type?.annualEntitlement ?? 0} disabled={method === "NONE"} />
          </Field>
          <Field label="Eligible after (months)" name="accrualStartAfterMonths" error={err("accrualStartAfterMonths")} hint="0 = from joining">
            <Input type="number" min={0} max={120} defaultValue={type?.accrualStartAfterMonths ?? 0} />
          </Field>
          {method === "NONE" && <input type="hidden" name="annualEntitlement" value="0" />}
          {method === "UPFRONT" && <Toggle name="prorateUpfront" label="Pro-rate for joiners" defaultChecked={type?.prorateUpfront ?? false} hint="By the remaining days of the year" />}
          <Field label="Carry forward max (days)" name="carryForwardMax" error={err("carryForwardMax")} hint="0 = no carry forward">
            <Input type="number" step="0.5" min={0} max={366} defaultValue={type?.carryForwardMax ?? 0} />
          </Field>
          <Field label="Carried days expire after (months)" name="carryForwardExpiryMonths" error={err("carryForwardExpiryMonths")} hint="Blank = never">
            <Input type="number" min={1} max={24} defaultValue={type?.carryForwardExpiryMonths ?? ""} />
          </Field>
        </fieldset>

        <fieldset className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
          <legend className="px-1 text-sm font-semibold">Rules</legend>
          <Field label="Minimum notice (days)" name="minNoticeDays" error={err("minNoticeDays")} hint="0 allows backdating up to 30 days">
            <Input type="number" min={0} max={365} defaultValue={type?.minNoticeDays ?? 0} />
          </Field>
          <Field label="Max days per request" name="maxConsecutiveDays" error={err("maxConsecutiveDays")} hint="Blank = no limit">
            <Input type="number" min={1} max={366} defaultValue={type?.maxConsecutiveDays ?? ""} />
          </Field>
          <Field label="Document required above (days)" name="requiresAttachmentAfterDays" error={err("requiresAttachmentAfterDays")} hint="0 = always, blank = never">
            <Input type="number" min={0} max={366} defaultValue={type?.requiresAttachmentAfterDays ?? ""} />
          </Field>
          <Field label="Eligible gender" name="genderEligibility" error={err("genderEligibility")}>
            <NativeSelect defaultValue={type?.genderEligibility ?? ""}>
              <option value="">Everyone</option>
              <option value="FEMALE">Female only</option>
              <option value="MALE">Male only</option>
            </NativeSelect>
          </Field>
          <div className="grid gap-2 sm:col-span-2">
            <Toggle name="isPaid" label="Paid leave" defaultChecked={type?.isPaid ?? true} hint="Unpaid days are deducted in payroll" />
            <Toggle name="allowHalfDay" label="Allow half days" defaultChecked={type?.allowHalfDay ?? true} />
            <Toggle name="allowNegativeBalance" label="Allow negative balance" defaultChecked={type?.allowNegativeBalance ?? false} />
            <Toggle name="countWeekends" label="Count weekends (calendar days)" defaultChecked={type?.countWeekends ?? false} />
            <Toggle name="countHolidays" label="Count public holidays" defaultChecked={type?.countHolidays ?? false} />
          </div>
        </fieldset>

        <fieldset className="grid gap-2 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold">Approval chain</legend>
          <p className="text-muted-foreground text-xs">Steps run in order. With no steps, requests are approved automatically.</p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="approvalChain" value="MANAGER" defaultChecked={chain.includes("MANAGER")} />
              1. Line manager
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="approvalChain" value="HR" defaultChecked={chain.includes("HR")} />
              2. HR
            </label>
          </div>
          {err("approvalChain") && <p className="text-destructive text-xs">{err("approvalChain")![0]}</p>}
        </fieldset>

        <Toggle name="isActive" label="Active (available to apply for)" defaultChecked={type?.isActive ?? true} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <SubmitButton pending={pending}>Save leave type</SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}
