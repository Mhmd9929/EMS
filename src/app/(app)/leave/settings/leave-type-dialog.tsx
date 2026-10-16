"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { saveLeaveTypeAction } from "@/server/actions/leave.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { brand } from "@/theme/brand";
import { useTranslations } from "next-intl";

type T = {
  id: string; name: string; code: string; description: string | null; color: string; isPaid: boolean; annualEntitlement: number;
  accrualMethod: string; accrualStartAfterMonths: number; prorateUpfront: boolean; carryForwardMax: number; carryForwardExpiryMonths: number | null;
  maxConsecutiveDays: number | null; requiresAttachmentAfterDays: number | null; minNoticeDays: number; allowHalfDay: boolean;
  allowNegativeBalance: boolean; genderEligibility: string | null; countWeekends: boolean; countHolidays: boolean; approvalChain: string[]; isActive: boolean; isEncashable: boolean;
};

function Toggle({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox name={name} defaultChecked={defaultChecked} className="mt-0.5" />
      <span>
        {label}
        {hint && <span className="text-muted-foreground block text-xs">{hint}</span>}
      </span>
    </label>
  );
}

export function LeaveTypeDialog({ type }: { type?: T }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("leave.typeDialog");
  const tc = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {type ? (
          <Button variant="ghost" size="sm" aria-label={t("editAria", { name: type.name })}>
            <Pencil aria-hidden /> {tc("edit")}
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden /> {t("new")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">{open && <TypeForm type={type} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function TypeForm({ type, onDone }: { type?: T; onDone: () => void }) {
  const router = useRouter();
  const t = useTranslations("leave.typeDialog");
  const tc = useTranslations("common");
  const { state, onSubmit, pending } = useFormAction(saveLeaveTypeAction);
  useActionFeedback(state, {
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });
  const err = (n: string) => fieldError(state, n);
  const [method, setMethod] = useState(type?.accrualMethod ?? "UPFRONT");
  const chain = type?.approvalChain ?? ["MANAGER"];
  return (
    <>
      <DialogHeader>
        <DialogTitle>{type ? t("editTitle", { name: type.name }) : t("new")}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-5">
        <FormError state={state} />
        {type && <input type="hidden" name="id" value={type.id} />}
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label={tc("name")} name="name" error={err("name")} required className="sm:col-span-2">
            <Input defaultValue={type?.name} />
          </Field>
          <Field label={t("code")} name="code" error={err("code")} required>
            <Input defaultValue={type?.code} className="uppercase" maxLength={10} />
          </Field>
          <Field label={t("colour")} name="color" error={err("color")}>
            <Input type="color" defaultValue={type?.color ?? brand.defaultLeaveTypeColor} className="h-9 p-1" />
          </Field>
          <Field label={tc("description")} name="description" error={err("description")} className="sm:col-span-4">
            <Textarea rows={2} defaultValue={type?.description ?? ""} />
          </Field>
        </div>

        <fieldset className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
          <legend className="px-1 text-sm font-semibold">{t("entitlement")}</legend>
          <Field label={t("accrualMethod")} name="accrualMethod" error={err("accrualMethod")}>
            <NativeSelect value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="UPFRONT">{t("upfront")}</option>
              <option value="MONTHLY">{t("monthly")}</option>
              <option value="NONE">{t("noBalance")}</option>
            </NativeSelect>
          </Field>
          <Field label={t("daysPerYear")} name="annualEntitlement" error={err("annualEntitlement")}>
            <Input type="number" step="0.5" min={0} max={366} defaultValue={type?.annualEntitlement ?? 0} disabled={method === "NONE"} />
          </Field>
          <Field label={t("eligibleAfter")} name="accrualStartAfterMonths" error={err("accrualStartAfterMonths")} hint={t("eligibleAfterHint")}>
            <Input type="number" min={0} max={120} defaultValue={type?.accrualStartAfterMonths ?? 0} />
          </Field>
          {method === "NONE" && <input type="hidden" name="annualEntitlement" value="0" />}
          {method === "UPFRONT" && <Toggle name="prorateUpfront" label={t("prorate")} defaultChecked={type?.prorateUpfront ?? false} hint={t("prorateHint")} />}
          <Field label={t("carryForwardMax")} name="carryForwardMax" error={err("carryForwardMax")} hint={t("carryForwardMaxHint")}>
            <Input type="number" step="0.5" min={0} max={366} defaultValue={type?.carryForwardMax ?? 0} />
          </Field>
          <Field label={t("carryForwardExpiry")} name="carryForwardExpiryMonths" error={err("carryForwardExpiryMonths")} hint={t("blankNever")}>
            <Input type="number" min={1} max={24} defaultValue={type?.carryForwardExpiryMonths ?? ""} />
          </Field>
        </fieldset>

        <fieldset className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
          <legend className="px-1 text-sm font-semibold">{t("rules")}</legend>
          <Field label={t("minNotice")} name="minNoticeDays" error={err("minNoticeDays")} hint={t("minNoticeHint")}>
            <Input type="number" min={0} max={365} defaultValue={type?.minNoticeDays ?? 0} />
          </Field>
          <Field label={t("maxPerRequest")} name="maxConsecutiveDays" error={err("maxConsecutiveDays")} hint={t("blankNoLimit")}>
            <Input type="number" min={1} max={366} defaultValue={type?.maxConsecutiveDays ?? ""} />
          </Field>
          <Field label={t("documentAbove")} name="requiresAttachmentAfterDays" error={err("requiresAttachmentAfterDays")} hint={t("documentAboveHint")}>
            <Input type="number" min={0} max={366} defaultValue={type?.requiresAttachmentAfterDays ?? ""} />
          </Field>
          <Field label={t("eligibleGender")} name="genderEligibility" error={err("genderEligibility")}>
            <NativeSelect defaultValue={type?.genderEligibility ?? ""}>
              <option value="">{t("everyone")}</option>
              <option value="FEMALE">{t("femaleOnly")}</option>
              <option value="MALE">{t("maleOnly")}</option>
            </NativeSelect>
          </Field>
          <div className="grid gap-2 sm:col-span-2">
            <Toggle name="isPaid" label={t("paid")} defaultChecked={type?.isPaid ?? true} hint={t("paidHint")} />
            <Toggle name="allowHalfDay" label={t("allowHalfDay")} defaultChecked={type?.allowHalfDay ?? true} />
            <Toggle name="allowNegativeBalance" label={t("allowNegative")} defaultChecked={type?.allowNegativeBalance ?? false} />
            <Toggle name="countWeekends" label={t("countWeekends")} defaultChecked={type?.countWeekends ?? false} />
            <Toggle name="countHolidays" label={t("countHolidays")} defaultChecked={type?.countHolidays ?? false} />
            <Toggle name="isEncashable" label={t("encashable")} defaultChecked={type?.isEncashable ?? false} />
          </div>
        </fieldset>

        <fieldset className="grid gap-2 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold">{t("approvalChain")}</legend>
          <p className="text-muted-foreground text-xs">{t("approvalChainHint")}</p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="approvalChain" value="MANAGER" defaultChecked={chain.includes("MANAGER")} />
              {t("lineManagerStep")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="approvalChain" value="HR" defaultChecked={chain.includes("HR")} />
              {t("hrStep")}
            </label>
          </div>
          {err("approvalChain") && <p className="text-destructive text-xs">{err("approvalChain")![0]}</p>}
        </fieldset>

        <Toggle name="isActive" label={t("active")} defaultChecked={type?.isActive ?? true} />
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
