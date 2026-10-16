"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteRoleAction, saveRoleAction } from "@/server/actions/admin.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { Checkbox, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";
import { ConfirmAction } from "@/components/confirm-action";

type Perm = { key: string; module: string; description: string };
type RoleValues = { id: string; name: string; description: string | null; permissions: string[] };

export function RoleDialog({ catalogue, role }: { catalogue: Perm[]; role?: RoleValues }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {role ? (
          <Button variant="ghost" size="sm" aria-label={t("roles.editLabel", { name: role.name })}>
            <Pencil aria-hidden /> {tc("edit")}
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden /> {t("roles.new")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">{open && <RoleForm catalogue={catalogue} role={role} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function RoleForm({ catalogue, role, onDone }: { catalogue: Perm[]; role?: RoleValues; onDone: () => void }) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(saveRoleAction);
  useActionFeedback(state, {
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });
  const modules = [...new Set(catalogue.map((p) => p.module))];
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  return (
    <>
      <DialogHeader>
        <DialogTitle>{role ? t("roles.editLabel", { name: role.name }) : t("roles.new")}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError state={state} />
        <input type="hidden" name="id" value={role?.id ?? ""} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tc("name")} name="name" error={fieldError(state, "name")} required>
            <Input defaultValue={role?.name} />
          </Field>
          <Field label={tc("description")} name="description" error={fieldError(state, "description")}>
            <Input defaultValue={role?.description ?? ""} />
          </Field>
        </div>
        <div className="grid max-h-[50vh] gap-4 overflow-y-auto pe-1">
          {modules.map((m) => (
            <fieldset key={m} className="grid gap-1.5">
              <legend className="mb-1 text-sm font-semibold">{m}</legend>
              {catalogue
                .filter((p) => p.module === m)
                .map((p) => (
                  <label key={p.key} className="hover:bg-accent flex items-start gap-3 rounded-md p-2 text-sm">
                    <Checkbox name="permissions" value={p.key} defaultChecked={role?.permissions.includes(p.key)} className="mt-0.5" />
                    <span>
                      <span className="block font-mono text-xs" dir="ltr">
                        {p.key}
                      </span>
                      <span className="text-muted-foreground block text-xs">{p.description}</span>
                    </span>
                  </label>
                ))}
            </fieldset>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {tc("cancel")}
          </Button>
          <SubmitButton pending={pending}>{t("roles.saveRole")}</SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}

export function DeleteRoleButton({ roleId, name }: { roleId: string; name: string }) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm" aria-label={t("roles.deleteLabel", { name })}>
          <Trash2 aria-hidden />
        </Button>
      }
      title={t("roles.deleteTitle", { name })}
      description={t("roles.deleteDescription")}
      destructive
      confirmLabel={tc("delete")}
      action={() => deleteRoleAction(roleId)}
      onDone={() => router.refresh()}
    />
  );
}
