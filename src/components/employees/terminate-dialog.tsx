"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserX } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("employees.terminate");
  const tc = useTranslations("common");
  const te = useTranslations("enums.terminationReason");
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
          <UserX aria-hidden /> {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { name })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <FormError state={state} />
          <input type="hidden" name="id" value={employeeId} />
          <Field label={t("lastWorkingDay")} name="lastWorkingDay" error={fieldError(state, "lastWorkingDay")} required>
            <Input type="date" min={minDate} />
          </Field>
          <Field label={tc("reason")} name="reason" error={fieldError(state, "reason")} required>
            <NativeSelect defaultValue="">
              <option value="" disabled>
                {t("selectReason")}
              </option>
              {TERMINATION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {te(r)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={tc("notes")} name="notes" error={fieldError(state, "notes")}>
            <Textarea rows={3} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton variant="destructive" pending={pending}>
              {t("confirm")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CancelTerminationButton({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const t = useTranslations("employees.terminate");
  return (
    <ConfirmAction
      trigger={<Button variant="outline">{t("cancelButton")}</Button>}
      title={t("cancelTitle")}
      description={t("cancelDescription")}
      action={() => cancelTerminationAction(employeeId)}
      onDone={() => router.refresh()}
    />
  );
}
