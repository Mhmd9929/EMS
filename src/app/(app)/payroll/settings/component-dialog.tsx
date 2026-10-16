"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { savePayComponentAction } from "@/server/actions/payroll.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox, Input, NativeSelect } from "@/components/ui/input";
import { useTranslations } from "next-intl";

type C = { id: string; code: string; name: string; kind: string; calcType: string; formula: string | null; isRecurring: boolean; isTaxable: boolean; isFixedPay: boolean; isActive: boolean; isSystem: boolean };

function Toggle({ name, label, defaultChecked, hint, disabled }: { name: string; label: string; defaultChecked: boolean; hint?: string; disabled?: boolean }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox name={name} defaultChecked={defaultChecked} disabled={disabled} className="mt-0.5" />
      <span>
        {label}
        {hint && <span className="text-muted-foreground block text-xs">{hint}</span>}
      </span>
    </label>
  );
}

export function ComponentDialog({ component, codes }: { component?: C; codes: string[] }) {
  const t = useTranslations("payroll.componentDialog");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {component ? (
          <Button variant="ghost" size="sm" aria-label={t("editLabel", { name: component.name })}>
            <Pencil aria-hidden /> {t("edit")}
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden /> {t("newButton")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">{open && <ComponentForm component={component} codes={codes} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function ComponentForm({ component: c, codes, onDone }: { component?: C; codes: string[]; onDone: () => void }) {
  const router = useRouter();
  const t = useTranslations("payroll.componentDialog");
  const tc = useTranslations("common");
  const te = useTranslations("enums.componentKind");
  const { state, onSubmit, pending } = useFormAction(savePayComponentAction);
  useActionFeedback(state, {
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });
  const err = (n: string) => fieldError(state, n);
  const [calcType, setCalcType] = useState(c?.calcType ?? "FIXED");
  const [kind, setKind] = useState(c?.kind ?? "EARNING");
  const system = !!c?.isSystem;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{c ? t("editTitle", { name: c.name }) : t("newTitle")}</DialogTitle>
        {system && <DialogDescription>{t("systemNote")}</DialogDescription>}
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError state={state} />
        {c && <input type="hidden" name="id" value={c.id} />}
        {/* Disabled inputs are not submitted: keep system values in hidden fields. */}
        {system && (
          <>
            <input type="hidden" name="code" value={c.code} />
            <input type="hidden" name="kind" value={c.kind} />
            {c.isRecurring && <input type="hidden" name="isRecurring" value="on" />}
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("name")} name="name" error={err("name")} required className="sm:col-span-2">
            <Input defaultValue={c?.name} />
          </Field>
          <Field label={t("code")} name={system ? "code-display" : "code"} error={err("code")} required hint={t("codeHint")}>
            <Input defaultValue={c?.code} className="font-mono uppercase" disabled={system} maxLength={30} dir="ltr" />
          </Field>
          <Field label={t("type")} name={system ? "kind-display" : "kind"} error={err("kind")} required>
            <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)} disabled={system}>
              <option value="EARNING">{te("EARNING")}</option>
              <option value="DEDUCTION">{te("DEDUCTION")}</option>
            </NativeSelect>
          </Field>
          <Field label={t("calculation")} name="calcType" error={err("calcType")} required className="sm:col-span-2">
            <NativeSelect value={calcType} onChange={(e) => setCalcType(e.target.value)}>
              <option value="FIXED">{t("fixedOption")}</option>
              <option value="FORMULA">{t("formulaOption")}</option>
            </NativeSelect>
          </Field>
        </div>
        {calcType === "FORMULA" && (
          <Field label={t("formula")} name="formula" error={err("formula")} required hint={t("formulaHint", { codes: codes.join(", ") })}>
            <Input defaultValue={c?.formula ?? ""} className="font-mono" placeholder="BASIC * 0.5" dir="ltr" />
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle name={system ? "isRecurring-display" : "isRecurring"} label={t("recurring")} defaultChecked={c?.isRecurring ?? true} disabled={system} hint={t("recurringHint")} />
          {kind === "EARNING" && <Toggle name="isFixedPay" label={t("fixedPay")} defaultChecked={c?.isFixedPay ?? true} hint={t("fixedPayHint")} />}
          <Toggle name="isTaxable" label={t("taxable")} defaultChecked={c?.isTaxable ?? false} hint={t("taxableHint")} />
          <Toggle name="isActive" label={t("active")} defaultChecked={c?.isActive ?? true} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {tc("cancel")}
          </Button>
          <SubmitButton pending={pending}>{tc("save")}</SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}
