"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import { saveLocationAction } from "@/server/actions/org.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { Checkbox, Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";
import { UAE_EMIRATES } from "@/lib/constants";

type Values = { id: string; name: string; code: string; address: string | null; city: string | null; emirate: string | null; country: string; isActive: boolean };

export function LocationDialog({ location }: { location?: Values }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("organization");
  const tc = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {location ? (
          <Button variant="ghost" size="sm" aria-label={t("locations.editLabel", { name: location.name })}>
            <Pencil aria-hidden /> {tc("edit")}
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden /> {t("locations.new")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>{open && <LocationForm location={location} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function LocationForm({ location, onDone }: { location?: Values; onDone: () => void }) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(saveLocationAction);
  useActionFeedback(state, {
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });
  const err = (n: string) => fieldError(state, n);
  const t = useTranslations("organization");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  return (
    <>
      <DialogHeader>
        <DialogTitle>{location ? t("locations.editLabel", { name: location.name }) : t("locations.new")}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError state={state} />
        {location && <input type="hidden" name="id" value={location.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tc("name")} name="name" error={err("name")} required>
            <Input defaultValue={location?.name} />
          </Field>
          <Field label={t("code")} name="code" error={err("code")} required>
            <Input defaultValue={location?.code} className="uppercase" />
          </Field>
        </div>
        <Field label={t("locations.columns.address")} name="address" error={err("address")}>
          <Input defaultValue={location?.address ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("locations.columns.city")} name="city" error={err("city")}>
            <Input defaultValue={location?.city ?? ""} />
          </Field>
          <Field label={t("locations.columns.emirate")} name="emirate" error={err("emirate")}>
            <NativeSelect defaultValue={location?.emirate ?? ""}>
              <option value="">—</option>
              {UAE_EMIRATES.map((e) => (
                <option key={e} value={e}>
                  {te(`emirate.${e}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("locations.columns.country")} name="country" error={err("country")} hint={t("locations.countryHint")}>
            <Input defaultValue={location?.country ?? "AE"} maxLength={2} className="uppercase" />
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="loc-active" name="isActive" defaultChecked={location?.isActive ?? true} />
          <Label htmlFor="loc-active">{t("active")}</Label>
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
