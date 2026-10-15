"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { saveLeavePolicyAction } from "@/server/actions/leave.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox, Input, NativeSelect } from "@/components/ui/input";
import { EMPLOYMENT_TYPES } from "@/lib/constants";

type Opt = { value: string; label: string };
type Policy = { id: string; name: string; leaveTypeId: string; departmentId: string | null; positionId: string | null; employmentType: string | null; isEligible: boolean; annualEntitlement: number | null; isActive: boolean };

export function PolicyDialog({ options, policy }: { options: { types: Opt[]; departments: Opt[]; positions: Opt[] }; policy?: Policy }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {policy ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${policy.name}`}>
            <Pencil aria-hidden /> Edit
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden /> New policy
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>{open && <PolicyForm options={options} policy={policy} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function PolicyForm({ options, policy, onDone }: { options: { types: Opt[]; departments: Opt[]; positions: Opt[] }; policy?: Policy; onDone: () => void }) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(saveLeavePolicyAction);
  useActionFeedback(state, {
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });
  const err = (n: string) => fieldError(state, n);
  const select = (list: Opt[], current: string | null | undefined, any: string) => (
    <NativeSelect defaultValue={current ?? ""}>
      <option value="">{any}</option>
      {list.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
  return (
    <>
      <DialogHeader>
        <DialogTitle>{policy ? `Edit ${policy.name}` : "New leave policy"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError state={state} />
        {policy && <input type="hidden" name="id" value={policy.id} />}
        <Field label="Name" name="name" error={err("name")} required>
          <Input defaultValue={policy?.name} placeholder="e.g. Sales — Annual 25 days" />
        </Field>
        <Field label="Leave type" name="leaveTypeId" error={err("leaveTypeId")} required>
          {select(options.types, policy?.leaveTypeId, "Choose…")}
        </Field>
        <p className="text-muted-foreground -mb-2 text-xs font-medium uppercase">Applies to (all that are set must match)</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Department" name="departmentId" error={err("departmentId")}>
            {select(options.departments, policy?.departmentId, "Any")}
          </Field>
          <Field label="Position" name="positionId" error={err("positionId")}>
            {select(options.positions, policy?.positionId, "Any")}
          </Field>
          <Field label="Employment type" name="employmentType" error={err("employmentType")}>
            {select(EMPLOYMENT_TYPES.map((t) => ({ value: t.value, label: t.label })), policy?.employmentType, "Any")}
          </Field>
        </div>
        <Field label="Days per year" name="annualEntitlement" error={err("annualEntitlement")} hint="Blank = leave type default">
          <Input type="number" step="0.5" min={0} max={366} defaultValue={policy?.annualEntitlement ?? ""} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="isEligible" defaultChecked={policy?.isEligible ?? true} /> Eligible (untick to exclude this group from the leave type)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="isActive" defaultChecked={policy?.isActive ?? true} /> Active
        </label>
        <p className="text-muted-foreground text-xs">Changes apply to future accruals; credits already granted are not recalculated (adjust balances if needed).</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <SubmitButton pending={pending}>Save policy</SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}
