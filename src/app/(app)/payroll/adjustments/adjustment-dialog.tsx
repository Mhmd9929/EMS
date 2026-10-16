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
import { useTranslations } from "next-intl";

type Opt = { value: string; label: string };

export function PeriodPicker({ value }: { value: string }) {
  const { update } = useUpdateParams();
  const t = useTranslations("payroll.adjustments");
  return <Input type="month" aria-label={t("month")} value={value} onChange={(e) => e.target.value && update({ period: e.target.value })} className="w-44" />;
}

export function AdjustmentDialog({ period, employees, components }: { period: string; employees: Opt[]; components: Opt[] }) {
  const t = useTranslations("payroll.adjustments");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden /> {t("addButton")}
        </Button>
      </DialogTrigger>
      <DialogContent>{open && <AdjustmentForm period={period} employees={employees} components={components} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function AdjustmentForm({ period, employees, components, onDone }: { period: string; employees: Opt[]; components: Opt[]; onDone: () => void }) {
  const router = useRouter();
  const t = useTranslations("payroll.adjustments");
  const tc = useTranslations("common");
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
        <DialogTitle>{t("addTitle")}</DialogTitle>
        <DialogDescription>{t("addDescription")}</DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError state={state} />
        <Field label={t("employee")} name="employeeId" error={err("employeeId")} required>
          <NativeSelect defaultValue="">
            <option value="">{t("choose")}</option>
            {employees.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("month")} name="period" error={err("period")} required>
            <Input type="month" defaultValue={period} />
          </Field>
          <Field label={t("component")} name="componentId" error={err("componentId")} required>
            <NativeSelect defaultValue="">
              <option value="">{t("choose")}</option>
              {components.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label={t("amount")} name="amount" error={err("amount")} required>
          <Input inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label={t("descriptionCol")} name="description" error={err("description")} hint={t("descriptionHint")} required>
          <Input maxLength={200} />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {tc("cancel")}
          </Button>
          <SubmitButton pending={pending}>{t("add")}</SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}

export function DeleteAdjustmentButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const t = useTranslations("payroll.adjustments");
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm" aria-label={t("deleteLabel", { label })}>
          <Trash2 aria-hidden />
        </Button>
      }
      title={t("deleteTitle")}
      description={label}
      confirmLabel={t("deleteConfirm")}
      destructive
      action={() => deleteAdjustmentAction(id)}
      onDone={() => router.refresh()}
    />
  );
}
