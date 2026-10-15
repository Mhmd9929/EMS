"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {location ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${location.name}`}>
            <Pencil aria-hidden /> Edit
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden /> New location
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
  return (
    <>
      <DialogHeader>
        <DialogTitle>{location ? `Edit ${location.name}` : "New location"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError state={state} />
        {location && <input type="hidden" name="id" value={location.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" name="name" error={err("name")} required>
            <Input defaultValue={location?.name} />
          </Field>
          <Field label="Code" name="code" error={err("code")} required>
            <Input defaultValue={location?.code} className="uppercase" />
          </Field>
        </div>
        <Field label="Address" name="address" error={err("address")}>
          <Input defaultValue={location?.address ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="City" name="city" error={err("city")}>
            <Input defaultValue={location?.city ?? ""} />
          </Field>
          <Field label="Emirate" name="emirate" error={err("emirate")}>
            <NativeSelect defaultValue={location?.emirate ?? ""}>
              <option value="">—</option>
              {UAE_EMIRATES.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Country" name="country" error={err("country")} hint="ISO code, e.g. AE">
            <Input defaultValue={location?.country ?? "AE"} maxLength={2} className="uppercase" />
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="loc-active" name="isActive" defaultChecked={location?.isActive ?? true} />
          <Label htmlFor="loc-active">Active</Label>
        </div>
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
