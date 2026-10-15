"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Undo2, X, XCircle } from "lucide-react";
import { decideLeaveAction, hrCancelLeaveAction, requestCancellationAction, withdrawLeaveAction } from "@/server/actions/leave.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmAction } from "@/components/confirm-action";

/** Approve / reject the current step (also used for cancellation requests). */
export function DecisionForm({ requestId, isCancellation, onBehalfOf }: { requestId: string; isCancellation: boolean; onBehalfOf: string | null }) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(decideLeaveAction);
  useActionFeedback(state, { onSuccess: () => router.refresh() });
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <FormError state={state} />
      {onBehalfOf && <p className="text-muted-foreground text-xs">You are acting as delegate for {onBehalfOf}.</p>}
      <input type="hidden" name="requestIds" value={requestId} />
      <Field label="Comment" name="comment" error={fieldError(state, "comment")} hint="Required when rejecting. Shared with the employee.">
        <Textarea rows={2} maxLength={1000} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="decision" value="APPROVED" pending={pending}>
          <Check aria-hidden /> {isCancellation ? "Approve cancellation" : "Approve"}
        </SubmitButton>
        <SubmitButton name="decision" value="REJECTED" variant="outline" disabled={pending}>
          <X aria-hidden /> {isCancellation ? "Keep the leave" : "Reject"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function WithdrawButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="outline">
          <Undo2 aria-hidden /> Withdraw request
        </Button>
      }
      title="Withdraw this request?"
      description="Your approver will no longer see it. Days are released immediately."
      confirmLabel="Withdraw"
      destructive
      action={() => withdrawLeaveAction(requestId)}
      onDone={(r) => r.ok && router.refresh()}
    />
  );
}

function ReasonDialog({
  requestId,
  trigger,
  title,
  description,
  submitLabel,
  action,
}: {
  requestId: string;
  trigger: React.ReactNode;
  title: string;
  description: string;
  submitLabel: string;
  action: typeof requestCancellationAction;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(action);
  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <FormError state={state} />
          <input type="hidden" name="requestId" value={requestId} />
          <Field label="Reason" name="reason" error={fieldError(state, "reason")} required>
            <Textarea rows={3} maxLength={1000} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Back
            </Button>
            <SubmitButton pending={pending} variant="destructive">
              {submitLabel}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RequestCancellationButton({ requestId }: { requestId: string }) {
  return (
    <ReasonDialog
      requestId={requestId}
      action={requestCancellationAction}
      title="Cancel approved leave?"
      description="Your approver needs to confirm. The days stay booked until they do."
      submitLabel="Request cancellation"
      trigger={
        <Button variant="outline">
          <XCircle aria-hidden /> Request cancellation
        </Button>
      }
    />
  );
}

export function HrCancelButton({ requestId }: { requestId: string }) {
  return (
    <ReasonDialog
      requestId={requestId}
      action={hrCancelLeaveAction}
      title="Cancel this leave (HR)"
      description="The leave is cancelled immediately and the days are returned to the balance. The employee is notified and the action is audited."
      submitLabel="Cancel leave"
      trigger={
        <Button variant="outline">
          <XCircle aria-hidden /> Cancel as HR
        </Button>
      }
    />
  );
}
