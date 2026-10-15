"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calculator, Check, Lock, RotateCcw, Send, Undo2, X } from "lucide-react";
import { approveRunAction, calculateRunAction, cancelRunAction, releaseRunAction, reopenRunAction, returnRunAction, submitRunAction } from "@/server/actions/payroll.actions";
import type { ActionResult } from "@/lib/action-result";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Textarea } from "@/components/ui/input";
import { ConfirmAction } from "@/components/confirm-action";

type Status = "DRAFT" | "CALCULATED" | "UNDER_REVIEW" | "APPROVED" | "RELEASED" | "CANCELLED";

export function RunActions({ runId, status, canManage, canApprove, isMaker, canReopen, blocking }: { runId: string; status: Status; canManage: boolean; canApprove: boolean; isMaker: boolean; canReopen: boolean; blocking: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Done");
      else toast.error(r.error);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2">
      {canManage && (status === "DRAFT" || status === "CALCULATED") && (
        <Button disabled={pending} onClick={() => run(() => calculateRunAction(runId))} variant={status === "DRAFT" ? "default" : "outline"}>
          <Calculator aria-hidden /> {status === "DRAFT" ? "Calculate" : "Recalculate"}
        </Button>
      )}
      {canManage && status === "CALCULATED" && (
        <Button disabled={pending || blocking > 0} onClick={() => run(() => submitRunAction(runId))} title={blocking ? "Resolve blocking issues first" : undefined}>
          <Send aria-hidden /> Submit for approval
        </Button>
      )}
      {status === "UNDER_REVIEW" && canApprove && <CommentDialog runId={runId} kind="approve" />}
      {status === "UNDER_REVIEW" && !canApprove && isMaker && <p className="text-muted-foreground self-center text-sm">Waiting for a second approver (maker-checker).</p>}
      {(status === "UNDER_REVIEW" || status === "APPROVED") && (canApprove || canManage) && <CommentDialog runId={runId} kind="return" />}
      {canManage && status === "APPROVED" && (
        <ConfirmAction
          trigger={
            <Button disabled={pending}>
              <Lock aria-hidden /> Release payroll
            </Button>
          }
          title="Release this payroll?"
          description="The run is locked, payslips are issued and every employee is notified. Only a Super Admin can reopen it afterwards."
          confirmLabel="Release"
          action={() => releaseRunAction(runId)}
          onDone={() => router.refresh()}
        />
      )}
      {canManage && ["DRAFT", "CALCULATED", "UNDER_REVIEW", "APPROVED"].includes(status) && <ReasonDialog runId={runId} kind="cancel" />}
      {canReopen && status === "RELEASED" && <ReasonDialog runId={runId} kind="reopen" />}
    </div>
  );
}

function CommentDialog({ runId, kind }: { runId: string; kind: "approve" | "return" }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(kind === "approve" ? approveRunAction : returnRunAction);
  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {kind === "approve" ? (
          <Button>
            <Check aria-hidden /> Approve
          </Button>
        ) : (
          <Button variant="outline">
            <Undo2 aria-hidden /> Send back
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === "approve" ? "Approve payroll" : "Send back for changes"}</DialogTitle>
          <DialogDescription>{kind === "approve" ? "You confirm you reviewed the register and variances." : "The run returns to Calculated so it can be fixed and recalculated."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <FormError state={state} />
          <input type="hidden" name="runId" value={runId} />
          <Field label="Comment" name="comment" error={fieldError(state, "comment")} required={kind === "return"}>
            <Textarea rows={3} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pending={pending}>{kind === "approve" ? "Approve" : "Send back"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReasonDialog({ runId, kind }: { runId: string; kind: "cancel" | "reopen" }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(kind === "cancel" ? cancelRunAction : reopenRunAction);
  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          {kind === "cancel" ? <X aria-hidden /> : <RotateCcw aria-hidden />} {kind === "cancel" ? "Cancel run" : "Reopen (Super Admin)"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === "cancel" ? "Cancel this run?" : "Reopen a released run?"}</DialogTitle>
          <DialogDescription>
            {kind === "cancel"
              ? "Cancelled runs are kept for the record but can't be changed. Employees in it can be paid in a new run."
              : "Payslips are withdrawn from employees and the run returns to Calculated. Everything is audited."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <FormError state={state} />
          <input type="hidden" name="runId" value={runId} />
          <Field label="Reason" name="reason" error={fieldError(state, "reason")} required>
            <Textarea rows={3} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Back
            </Button>
            <SubmitButton pending={pending} variant="destructive">
              {kind === "cancel" ? "Cancel run" : "Reopen"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
