"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { createRunAction } from "@/server/actions/payroll.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";

type Opt = { value: string; label: string };

export function NewRunDialog({ defaultPeriod, departments, locations }: { defaultPeriod: string; departments: Opt[]; locations: Opt[] }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("ALL");
  const { state, onSubmit, pending } = useFormAction(createRunAction);
  useActionFeedback(state, { silentSuccess: true });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden /> New payroll run
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New payroll run</DialogTitle>
          <DialogDescription>Uses the company proration basis and every approved unpaid leave and adjustment for the month.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <FormError state={state} />
          <Field label="Month" name="period" error={fieldError(state, "period")} required>
            <Input type="month" defaultValue={defaultPeriod} />
          </Field>
          <Field label="Employees" name="scope" error={fieldError(state, "scope")}>
            <NativeSelect value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="ALL">All employees</option>
              <option value="DEPARTMENT">One department</option>
              <option value="LOCATION">One location</option>
            </NativeSelect>
          </Field>
          {scope !== "ALL" && (
            <Field label={scope === "DEPARTMENT" ? "Department" : "Location"} name="scopeId" error={fieldError(state, "scopeId")} required>
              <NativeSelect defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {(scope === "DEPARTMENT" ? departments : locations).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          {scope === "ALL" && <input type="hidden" name="scopeId" value="" />}
          <Field label="Notes" name="notes" error={fieldError(state, "notes")}>
            <Textarea rows={2} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pending={pending}>Create run</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
