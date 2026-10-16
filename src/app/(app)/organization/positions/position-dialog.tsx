"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import { savePositionAction } from "@/server/actions/org.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";

type Values = { id: string; title: string; code: string; grade: string | null; level: number | null; description: string | null; isActive: boolean };

export function PositionDialog({ position }: { position?: Values }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("organization");
  const tc = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {position ? (
          <Button variant="ghost" size="sm" aria-label={t("positions.editLabel", { name: position.title })}>
            <Pencil aria-hidden /> {tc("edit")}
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden /> {t("positions.new")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>{open && <PositionForm position={position} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function PositionForm({ position, onDone }: { position?: Values; onDone: () => void }) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(savePositionAction);
  useActionFeedback(state, {
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });
  const err = (n: string) => fieldError(state, n);
  const t = useTranslations("organization");
  const tc = useTranslations("common");
  return (
    <>
      <DialogHeader>
        <DialogTitle>{position ? t("positions.editLabel", { name: position.title }) : t("positions.new")}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError state={state} />
        {position && <input type="hidden" name="id" value={position.id} />}
        <Field label={t("positions.columns.title")} name="title" error={err("title")} required>
          <Input defaultValue={position?.title} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("code")} name="code" error={err("code")} required>
            <Input defaultValue={position?.code} className="uppercase" />
          </Field>
          <Field label={t("positions.columns.grade")} name="grade" error={err("grade")}>
            <Input defaultValue={position?.grade ?? ""} placeholder="G5" />
          </Field>
          <Field label={t("positions.columns.level")} name="level" error={err("level")}>
            <Input type="number" min={0} max={100} defaultValue={position?.level ?? ""} />
          </Field>
        </div>
        <Field label={tc("description")} name="description" error={err("description")}>
          <Textarea rows={2} defaultValue={position?.description ?? ""} />
        </Field>
        <div className="flex items-center gap-2">
          <Checkbox id="pos-active" name="isActive" defaultChecked={position?.isActive ?? true} />
          <Label htmlFor="pos-active">{t("active")}</Label>
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
