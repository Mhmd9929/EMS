"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { copyHolidaysAction, deleteHolidayAction, saveHolidayAction } from "@/server/actions/leave.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, NativeSelect } from "@/components/ui/input";
import { ConfirmAction } from "@/components/confirm-action";
import { useTranslations } from "next-intl";

type H = { id: string; name: string; date: string; locationId: string | null };

export function HolidayDialog({ locations, holiday, defaultDate }: { locations: { value: string; label: string }[]; holiday?: H; defaultDate?: string }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("leave.holidayDialog");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {holiday ? (
          <Button variant="ghost" size="sm" aria-label={t("editAria", { name: holiday.name })}>
            <Pencil aria-hidden />
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden /> {t("add")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>{open && <HolidayForm locations={locations} holiday={holiday} defaultDate={defaultDate} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function HolidayForm({ locations, holiday, defaultDate, onDone }: { locations: { value: string; label: string }[]; holiday?: H; defaultDate?: string; onDone: () => void }) {
  const router = useRouter();
  const t = useTranslations("leave.holidayDialog");
  const tc = useTranslations("common");
  const tl = useTranslations("leave");
  const { state, onSubmit, pending } = useFormAction(saveHolidayAction);
  useActionFeedback(state, {
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });
  return (
    <>
      <DialogHeader>
        <DialogTitle>{holiday ? t("editTitle") : t("addTitle")}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError state={state} />
        {holiday && <input type="hidden" name="id" value={holiday.id} />}
        <Field label={tc("name")} name="name" error={fieldError(state, "name")} required>
          <Input defaultValue={holiday?.name} placeholder={t("namePlaceholder")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={holiday ? tc("date") : tl("apply.firstDay")} name="date" error={fieldError(state, "date")} required>
            <Input type="date" defaultValue={holiday?.date ?? defaultDate} />
          </Field>
          {!holiday && (
            <Field label={tl("apply.lastDay")} name="endDate" error={fieldError(state, "endDate")} hint={t("multiDayHint")}>
              <Input type="date" />
            </Field>
          )}
        </div>
        <Field label={tc("location")} name="locationId" error={fieldError(state, "locationId")}>
          <NativeSelect defaultValue={holiday?.locationId ?? ""}>
            <option value="">{tl("settings.holidays.allLocations")}</option>
            {locations.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
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

export function DeleteHolidayButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const t = useTranslations("leave.holidayDialog");
  const tc = useTranslations("common");
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm" aria-label={t("deleteAria", { name })}>
          <Trash2 aria-hidden />
        </Button>
      }
      title={t("deleteTitle", { name })}
      description={t("deleteDescription")}
      destructive
      confirmLabel={tc("delete")}
      action={() => deleteHolidayAction(id)}
      onDone={() => router.refresh()}
    />
  );
}

export function CopyHolidaysButton({ fromYear, toYear }: { fromYear: number; toYear: number }) {
  const router = useRouter();
  const t = useTranslations("leave.holidayDialog");
  return (
    <ConfirmAction
      trigger={
        <Button variant="outline">
          <Copy aria-hidden /> {t("copyFrom", { year: String(fromYear) })}
        </Button>
      }
      title={t("copyTitle", { from: String(fromYear), to: String(toYear) })}
      description={t("copyDescription")}
      action={() => copyHolidaysAction(fromYear, toYear)}
      onDone={() => router.refresh()}
    />
  );
}
