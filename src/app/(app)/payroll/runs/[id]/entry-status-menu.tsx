"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setEntryStatusAction } from "@/server/actions/payroll.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";

type S = "INCLUDED" | "HELD" | "EXCLUDED";

export function EntryStatusMenu({ entryId, name, status, reason }: { entryId: string; name: string; status: S; reason: string | null }) {
  const t = useTranslations("payroll.entryStatus");
  const te = useTranslations("enums.entryStatus");
  const tc = useTranslations("common");
  const [target, setTarget] = useState<S | null>(null);
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(setEntryStatusAction);
  useActionFeedback(state, {
    onSuccess: () => {
      setTarget(null);
      router.refresh();
    },
  });
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-1" aria-label={t("changeStatusOf", { name })} title={reason ?? undefined}>
            <Badge variant={status === "INCLUDED" ? "success" : "secondary"}>{te(status)} ▾</Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(["INCLUDED", "HELD", "EXCLUDED"] as S[])
            .filter((s) => s !== status)
            .map((s) => (
              <DropdownMenuItem key={s} onSelect={() => setTarget(s)}>
                {s === "INCLUDED" ? t("include") : s === "HELD" ? t("hold") : t("exclude")}
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(target === "INCLUDED" ? "includeTitle" : target === "HELD" ? "holdTitle" : "excludeTitle", { name })}
            </DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4">
            <FormError state={state} />
            <input type="hidden" name="entryId" value={entryId} />
            <input type="hidden" name="status" value={target ?? ""} />
            {target !== "INCLUDED" && (
              <Field label={t("reason")} name="reason" error={fieldError(state, "reason")} required>
                <Input placeholder={t("reasonPlaceholder")} />
              </Field>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTarget(null)}>
                {tc("cancel")}
              </Button>
              <SubmitButton pending={pending}>{tc("confirm")}</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
