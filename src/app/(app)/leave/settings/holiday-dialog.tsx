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

type H = { id: string; name: string; date: string; locationId: string | null };

export function HolidayDialog({ locations, holiday, defaultDate }: { locations: { value: string; label: string }[]; holiday?: H; defaultDate?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {holiday ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${holiday.name}`}>
            <Pencil aria-hidden />
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden /> Add holiday
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>{open && <HolidayForm locations={locations} holiday={holiday} defaultDate={defaultDate} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function HolidayForm({ locations, holiday, defaultDate, onDone }: { locations: { value: string; label: string }[]; holiday?: H; defaultDate?: string; onDone: () => void }) {
  const router = useRouter();
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
        <DialogTitle>{holiday ? "Edit holiday" : "Add public holiday"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError state={state} />
        {holiday && <input type="hidden" name="id" value={holiday.id} />}
        <Field label="Name" name="name" error={fieldError(state, "name")} required>
          <Input defaultValue={holiday?.name} placeholder="e.g. Eid Al Fitr" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={holiday ? "Date" : "First day"} name="date" error={fieldError(state, "date")} required>
            <Input type="date" defaultValue={holiday?.date ?? defaultDate} />
          </Field>
          {!holiday && (
            <Field label="Last day" name="endDate" error={fieldError(state, "endDate")} hint="For multi-day holidays">
              <Input type="date" />
            </Field>
          )}
        </div>
        <Field label="Location" name="locationId" error={fieldError(state, "locationId")}>
          <NativeSelect defaultValue={holiday?.locationId ?? ""}>
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <SubmitButton pending={pending}>Save</SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}

export function DeleteHolidayButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm" aria-label={`Delete ${name}`}>
          <Trash2 aria-hidden />
        </Button>
      }
      title={`Delete ${name}?`}
      description="Requests already submitted keep their calculated days."
      destructive
      confirmLabel="Delete"
      action={() => deleteHolidayAction(id)}
      onDone={() => router.refresh()}
    />
  );
}

export function CopyHolidaysButton({ fromYear, toYear }: { fromYear: number; toYear: number }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="outline">
          <Copy aria-hidden /> Copy from {fromYear}
        </Button>
      }
      title={`Copy ${fromYear}'s holidays to ${toYear}?`}
      description="Same day and month. Lunar (Islamic) holidays move every year, so adjust them afterwards."
      action={() => copyHolidaysAction(fromYear, toYear)}
      onDone={() => router.refresh()}
    />
  );
}
