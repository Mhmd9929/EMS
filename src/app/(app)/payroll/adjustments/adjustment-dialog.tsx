"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { deleteAdjustmentAction, saveAdjustmentAction } from "@/server/actions/payroll.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { useUpdateParams } from "@/components/data-table/toolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, NativeSelect } from "@/components/ui/input";
import { ConfirmAction } from "@/components/confirm-action";

type Opt = { value: string; label: string };

export function PeriodPicker({ value }: { value: string }) {
  const { update } = useUpdateParams();
  return <Input type="month" aria-label="Month" value={value} onChange={(e) => e.target.value && update({ period: e.target.value })} className="w-44" />;
}

export function AdjustmentDialog({ period, employees, components }: { period: string; employees: Opt[]; components: Opt[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden /> Add adjustment
        </Button>
      </DialogTrigger>
      <DialogContent>{open && <AdjustmentForm period={period} employees={employees} components={components} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function AdjustmentForm({ period, employees, components, onDone }: { period: string; employees: Opt[]; components: Opt[]; onDone: () => void }) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(saveAdjustmentAction);
  useActionFeedback(state, {
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });
  const err = (n: string) => fieldError(state, n);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Add adjustment</DialogTitle>
        <DialogDescription>Paid (or deducted) once, in the chosen month&apos;s payroll.</DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError state={state} />
        <Field label="Employee" name="employeeId" error={err("employeeId")} required>
          <NativeSelect defaultValue="">
            <option value="">Choose…</option>
            {employees.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Month" name="period" error={err("period")} required>
            <Input type="month" defaultValue={period} />
          </Field>
          <Field label="Component" name="componentId" error={err("componentId")} required>
            <NativeSelect defaultValue="">
              <option value="">Choose…</option>
              {components.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Amount" name="amount" error={err("amount")} required>
          <Input inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="Description" name="description" error={err("description")} hint="Shown on the payslip" required>
          <Input maxLength={200} />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <SubmitButton pending={pending}>Add</SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}

export function DeleteAdjustmentButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm" aria-label={`Delete ${label}`}>
          <Trash2 aria-hidden />
        </Button>
      }
      title="Delete this adjustment?"
      description={label}
      confirmLabel="Delete"
      destructive
      action={() => deleteAdjustmentAction(id)}
      onDone={() => router.refresh()}
    />
  );
}
