"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { createRunAction } from "@/server/actions/payroll.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useTranslations } from "next-intl";

type Opt = { value: string; label: string };

export function NewRunDialog({ defaultPeriod, departments, locations }: { defaultPeriod: string; departments: Opt[]; locations: Opt[] }) {
  const t = useTranslations("payroll.newRun");
  const tc = useTranslations("common");
  const te = useTranslations("enums.runScope");
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("ALL");
  const { state, onSubmit, pending } = useFormAction(createRunAction);
  useActionFeedback(state, { silentSuccess: true });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden /> {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <FormError state={state} />
          <Field label={t("month")} name="period" error={fieldError(state, "period")} required>
            <Input type="month" defaultValue={defaultPeriod} />
          </Field>
          <Field label={t("employees")} name="scope" error={fieldError(state, "scope")}>
            <NativeSelect value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="ALL">{te("ALL")}</option>
              <option value="DEPARTMENT">{te("DEPARTMENT")}</option>
              <option value="LOCATION">{te("LOCATION")}</option>
            </NativeSelect>
          </Field>
          {scope !== "ALL" && (
            <Field label={scope === "DEPARTMENT" ? t("department") : t("location")} name="scopeId" error={fieldError(state, "scopeId")} required>
              <NativeSelect defaultValue="">
                <option value="" disabled>
                  {t("choose")}
                </option>
                {(scope === "DEPARTMENT" ? departments : locations).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          {scope === "ALL" && <input type="hidden" name="scopeId" value="" />}
          <Field label={t("notes")} name="notes" error={fieldError(state, "notes")}>
            <Textarea rows={2} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pending={pending}>{t("create")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
