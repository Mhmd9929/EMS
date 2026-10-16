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
import { useTranslations } from "next-intl";

/** Approve / reject the current step (also used for cancellation requests). */
export function DecisionForm({ requestId, isCancellation, onBehalfOf }: { requestId: string; isCancellation: boolean; onBehalfOf: string | null }) {
  const router = useRouter();
  const t = useTranslations("leave.actions");
  const tc = useTranslations("common");
  const { state, onSubmit, pending } = useFormAction(decideLeaveAction);
  useActionFeedback(state, { onSuccess: () => router.refresh() });
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <FormError state={state} />
      {onBehalfOf && <p className="text-muted-foreground text-xs">{t("actingAsDelegate", { name: onBehalfOf })}</p>}
      <input type="hidden" name="requestIds" value={requestId} />
      <Field label={tc("comment")} name="comment" error={fieldError(state, "comment")} hint={t("commentHint")}>
        <Textarea rows={2} maxLength={1000} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="decision" value="APPROVED" pending={pending}>
          <Check aria-hidden /> {isCancellation ? t("approveCancellation") : t("approve")}
        </SubmitButton>
        <SubmitButton name="decision" value="REJECTED" variant="outline" disabled={pending}>
          <X aria-hidden /> {isCancellation ? t("keepLeave") : t("reject")}
        </SubmitButton>
      </div>
    </form>
  );
}

export function WithdrawButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const t = useTranslations("leave.actions");
  return (
    <ConfirmAction
      trigger={
        <Button variant="outline">
          <Undo2 aria-hidden /> {t("withdrawButton")}
        </Button>
      }
      title={t("withdrawTitle")}
      description={t("withdrawDescription")}
      confirmLabel={t("withdrawConfirm")}
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
  const tc = useTranslations("common");
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
          <Field label={tc("reason")} name="reason" error={fieldError(state, "reason")} required>
            <Textarea rows={3} maxLength={1000} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("back")}
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
  const t = useTranslations("leave.actions");
  return (
    <ReasonDialog
      requestId={requestId}
      action={requestCancellationAction}
      title={t("cancelTitle")}
      description={t("cancelDescription")}
      submitLabel={t("requestCancellation")}
      trigger={
        <Button variant="outline">
          <XCircle aria-hidden /> {t("requestCancellation")}
        </Button>
      }
    />
  );
}

export function HrCancelButton({ requestId }: { requestId: string }) {
  const t = useTranslations("leave.actions");
  return (
    <ReasonDialog
      requestId={requestId}
      action={hrCancelLeaveAction}
      title={t("hrCancelTitle")}
      description={t("hrCancelDescription")}
      submitLabel={t("hrCancelSubmit")}
      trigger={
        <Button variant="outline">
          <XCircle aria-hidden /> {t("hrCancelTrigger")}
        </Button>
      }
    />
  );
}
