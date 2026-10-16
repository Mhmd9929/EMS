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
import { useTranslations } from "next-intl";

type Opt = { value: string; label: string };
type Policy = { id: string; name: string; leaveTypeId: string; departmentId: string | null; positionId: string | null; employmentType: string | null; isEligible: boolean; annualEntitlement: number | null; isActive: boolean };

export function PolicyDialog({ options, policy }: { options: { types: Opt[]; departments: Opt[]; positions: Opt[] }; policy?: Policy }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("leave.policyDialog");
  const tc = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {policy ? (
          <Button variant="ghost" size="sm" aria-label={t("editAria", { name: policy.name })}>
            <Pencil aria-hidden /> {tc("edit")}
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden /> {t("new")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>{open && <PolicyForm options={options} policy={policy} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function PolicyForm({ options, policy, onDone }: { options: { types: Opt[]; departments: Opt[]; positions: Opt[] }; policy?: Policy; onDone: () => void }) {
  const router = useRouter();
  const t = useTranslations("leave.policyDialog");
  const tc = useTranslations("common");
  const tl = useTranslations("leave");
  const te = useTranslations("enums");
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
        <DialogTitle>{policy ? t("editTitle", { name: policy.name }) : t("newTitle")}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError state={state} />
        {policy && <input type="hidden" name="id" value={policy.id} />}
        <Field label={tc("name")} name="name" error={err("name")} required>
          <Input defaultValue={policy?.name} placeholder={t("namePlaceholder")} />
        </Field>
        <Field label={tl("columns.leaveType")} name="leaveTypeId" error={err("leaveTypeId")} required>
          {select(options.types, policy?.leaveTypeId, tl("apply.choose"))}
        </Field>
        <p className="text-muted-foreground -mb-2 text-xs font-medium uppercase">{t("appliesTo")}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={tc("department")} name="departmentId" error={err("departmentId")}>
            {select(options.departments, policy?.departmentId, t("any"))}
          </Field>
          <Field label={tc("position")} name="positionId" error={err("positionId")}>
            {select(options.positions, policy?.positionId, t("any"))}
          </Field>
          <Field label={t("employmentType")} name="employmentType" error={err("employmentType")}>
            {select(EMPLOYMENT_TYPES.map((et) => ({ value: et.value, label: te(`employmentType.${et.value}`) })), policy?.employmentType, t("any"))}
          </Field>
        </div>
        <Field label={t("daysPerYear")} name="annualEntitlement" error={err("annualEntitlement")} hint={t("defaultHint")}>
          <Input type="number" step="0.5" min={0} max={366} defaultValue={policy?.annualEntitlement ?? ""} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="isEligible" defaultChecked={policy?.isEligible ?? true} /> {t("eligible")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="isActive" defaultChecked={policy?.isActive ?? true} /> {t("active")}
        </label>
        <p className="text-muted-foreground text-xs">{t("changesNote")}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {tc("cancel")}
          </Button>
          <SubmitButton pending={pending}>{t("save")}</SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}
