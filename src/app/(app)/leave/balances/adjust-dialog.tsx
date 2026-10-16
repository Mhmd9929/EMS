"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { adjustBalanceAction } from "@/server/actions/leave.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, Textarea } from "@/components/ui/input";
import { useTranslations } from "next-intl";

export function AdjustBalanceDialog({ employeeId, employeeName, leaveTypeId, leaveTypeName, year }: { employeeId: string; employeeName: string; leaveTypeId: string; leaveTypeName: string; year: number }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = useTranslations("leave.adjust");
  const tc = useTranslations("common");
  const { state, onSubmit, pending } = useFormAction(adjustBalanceAction);
  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("aria", { name: employeeName })}>
          <SlidersHorizontal aria-hidden /> {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { type: leaveTypeName })}</DialogTitle>
          <DialogDescription>
            {t("description", { name: employeeName, year: String(year) })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <FormError state={state} />
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="leaveTypeId" value={leaveTypeId} />
          <input type="hidden" name="year" value={year} />
          <Field label={t("days")} name="days" error={fieldError(state, "days")} required hint={t("daysHint")}>
            <Input type="number" step="0.5" min={-366} max={366} />
          </Field>
          <Field label={tc("reason")} name="reason" error={fieldError(state, "reason")} required>
            <Textarea rows={2} maxLength={500} placeholder={t("reasonPlaceholder")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pending={pending}>{t("save")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
