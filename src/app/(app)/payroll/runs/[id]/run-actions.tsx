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
import { useTranslations } from "next-intl";

type Status = "DRAFT" | "CALCULATED" | "UNDER_REVIEW" | "APPROVED" | "RELEASED" | "CANCELLED";

export function RunActions({ runId, status, canManage, canApprove, isMaker, canReopen, blocking }: { runId: string; status: Status; canManage: boolean; canApprove: boolean; isMaker: boolean; canReopen: boolean; blocking: number }) {
  const router = useRouter();
  const t = useTranslations("payroll.actions");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? tc("done"));
      else toast.error(r.error);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2">
      {canManage && (status === "DRAFT" || status === "CALCULATED") && (
        <Button disabled={pending} onClick={() => run(() => calculateRunAction(runId))} variant={status === "DRAFT" ? "default" : "outline"}>
          <Calculator aria-hidden /> {status === "DRAFT" ? t("calculate") : t("recalculate")}
        </Button>
      )}
      {canManage && status === "CALCULATED" && (
        <Button disabled={pending || blocking > 0} onClick={() => run(() => submitRunAction(runId))} title={blocking ? t("resolveFirst") : undefined}>
          <Send aria-hidden /> {t("submit")}
        </Button>
      )}
      {status === "UNDER_REVIEW" && canApprove && <CommentDialog runId={runId} kind="approve" />}
      {status === "UNDER_REVIEW" && !canApprove && isMaker && <p className="text-muted-foreground self-center text-sm">{t("waitingApprover")}</p>}
      {(status === "UNDER_REVIEW" || status === "APPROVED") && (canApprove || canManage) && <CommentDialog runId={runId} kind="return" />}
      {canManage && status === "APPROVED" && (
        <ConfirmAction
          trigger={
            <Button disabled={pending}>
              <Lock aria-hidden /> {t("releaseButton")}
            </Button>
          }
          title={t("releaseTitle")}
          description={t("releaseDescription")}
          confirmLabel={t("releaseConfirm")}
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
  const t = useTranslations("payroll.actions");
  const tc = useTranslations("common");
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
            <Check aria-hidden /> {t("approve")}
          </Button>
        ) : (
          <Button variant="outline">
            <Undo2 aria-hidden /> {t("sendBack")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === "approve" ? t("approveTitle") : t("sendBackTitle")}</DialogTitle>
          <DialogDescription>{kind === "approve" ? t("approveDescription") : t("sendBackDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <FormError state={state} />
          <input type="hidden" name="runId" value={runId} />
          <Field label={t("comment")} name="comment" error={fieldError(state, "comment")} required={kind === "return"}>
            <Textarea rows={3} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pending={pending}>{kind === "approve" ? t("approve") : t("sendBack")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReasonDialog({ runId, kind }: { runId: string; kind: "cancel" | "reopen" }) {
  const t = useTranslations("payroll.actions");
  const tc = useTranslations("common");
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
          {kind === "cancel" ? <X aria-hidden /> : <RotateCcw aria-hidden />} {kind === "cancel" ? t("cancelRun") : t("reopenButton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === "cancel" ? t("cancelTitle") : t("reopenTitle")}</DialogTitle>
          <DialogDescription>
            {kind === "cancel" ? t("cancelDescription") : t("reopenDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <FormError state={state} />
          <input type="hidden" name="runId" value={runId} />
          <Field label={t("reason")} name="reason" error={fieldError(state, "reason")} required>
            <Textarea rows={3} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("back")}
            </Button>
            <SubmitButton pending={pending} variant="destructive">
              {kind === "cancel" ? t("cancelRun") : t("reopen")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
