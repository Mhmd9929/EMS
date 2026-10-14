"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserX } from "lucide-react";
import { cancelTerminationAction, terminateEmployeeAction } from "@/server/actions/employee.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";
import { ConfirmAction } from "@/components/confirm-action";
import { TERMINATION_REASONS } from "@/lib/constants";

export function TerminateDialog({ employeeId, name, minDate }: { employeeId: string; name: string; minDate: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(terminateEmployeeAction);
  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <UserX aria-hidden /> Terminate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Terminate {name}</DialogTitle>
          <DialogDescription>
            The record is kept (never deleted). Sign-in is blocked after the last working day; if that date has already passed it takes effect immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <FormError state={state} />
          <input type="hidden" name="id" value={employeeId} />
          <Field label="Last working day" name="lastWorkingDay" error={fieldError(state, "lastWorkingDay")} required>
            <Input type="date" min={minDate} />
          </Field>
          <Field label="Reason" name="reason" error={fieldError(state, "reason")} required>
            <NativeSelect defaultValue="">
              <option value="" disabled>
                Select a reason
              </option>
              {TERMINATION_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Notes" name="notes" error={fieldError(state, "notes")}>
            <Textarea rows={3} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant="destructive" pending={pending}>
              Confirm termination
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CancelTerminationButton({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={<Button variant="outline">Cancel termination</Button>}
      title="Cancel the scheduled termination?"
      description="The employee stays active with no last working day."
      action={() => cancelTerminationAction(employeeId)}
      onDone={() => router.refresh()}
    />
  );
}
