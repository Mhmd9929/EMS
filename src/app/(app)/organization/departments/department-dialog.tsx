"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { saveDepartmentAction } from "@/server/actions/org.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";

export type DepartmentValues = {
  id: string;
  name: string;
  code: string;
  costCenterCode: string | null;
  description: string | null;
  parentId: string | null;
  headId: string | null;
  isActive: boolean;
};

type Options = { parents: { value: string; label: string; isActive: boolean }[]; employees: { value: string; label: string }[] };

export function DepartmentDialog({ department, options, trigger }: { department?: DepartmentValues; options: Options; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ??
          (department ? (
            <Button variant="ghost" size="sm" aria-label={`Edit ${department.name}`}>
              <Pencil aria-hidden /> Edit
            </Button>
          ) : (
            <Button>
              <Plus aria-hidden /> New department
            </Button>
          ))}
      </DialogTrigger>
      <DialogContent>{open && <DepartmentForm department={department} options={options} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function DepartmentForm({ department, options, onDone }: { department?: DepartmentValues; options: Options; onDone: () => void }) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(saveDepartmentAction);
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
        <DialogTitle>{department ? `Edit ${department.name}` : "New department"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError state={state} />
        {department && <input type="hidden" name="id" value={department.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" name="name" error={err("name")} required>
            <Input defaultValue={department?.name} />
          </Field>
          <Field label="Code" name="code" error={err("code")} required hint="Used in CSV imports">
            <Input defaultValue={department?.code} className="uppercase" />
          </Field>
        </div>
        <Field label="Parent department" name="parentId" error={err("parentId")}>
          <NativeSelect defaultValue={department?.parentId ?? ""}>
            <option value="">— Top level —</option>
            {options.parents
              .filter((p) => p.value !== department?.id && (p.isActive || p.value === department?.parentId))
              .map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <Field label="Department head" name="headId" error={err("headId")}>
          <NativeSelect defaultValue={department?.headId ?? ""}>
            <option value="">— None —</option>
            {options.employees.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Cost centre code" name="costCenterCode" error={err("costCenterCode")}>
          <Input defaultValue={department?.costCenterCode ?? ""} />
        </Field>
        <Field label="Description" name="description" error={err("description")}>
          <Textarea rows={2} defaultValue={department?.description ?? ""} />
        </Field>
        <div className="flex items-center gap-2">
          <Checkbox id="dep-active" name="isActive" defaultChecked={department?.isActive ?? true} />
          <Label htmlFor="dep-active">Active</Label>
        </div>
        {err("isActive") && <p className="text-destructive text-xs">{err("isActive")![0]}</p>}
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
