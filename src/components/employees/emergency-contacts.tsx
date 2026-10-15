"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { EmergencyContact } from "@prisma/client";
import { deleteEmergencyContactAction, saveEmergencyContactAction } from "@/server/actions/employee.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";
import { ConfirmAction } from "@/components/confirm-action";

export function EmergencyContacts({ employeeId, contacts, canManage }: { employeeId: string; contacts: EmergencyContact[]; canManage: boolean }) {
  const [editing, setEditing] = useState<EmergencyContact | "new" | null>(null);
  const router = useRouter();
  return (
    <div className="space-y-3">
      {contacts.length === 0 ? (
        <p className="text-muted-foreground text-sm">No emergency contacts recorded.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {c.name} <span className="text-muted-foreground font-normal">· {c.relationship}</span>
                </p>
                <p className="text-muted-foreground truncate">
                  {c.phone}
                  {c.email && ` · ${c.email}`}
                </p>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}>
                    <Pencil aria-hidden />
                  </Button>
                  <ConfirmAction
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`Remove ${c.name}`}>
                        <Trash2 aria-hidden />
                      </Button>
                    }
                    title={`Remove ${c.name}?`}
                    destructive
                    confirmLabel="Remove"
                    action={() => deleteEmergencyContactAction(c.id)}
                    onDone={() => router.refresh()}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && contacts.length < 5 && (
        <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
          <Plus aria-hidden /> Add contact
        </Button>
      )}
      {editing && (
        <ContactDialog
          employeeId={employeeId}
          contact={editing === "new" ? null : editing}
          onClose={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ContactDialog({ employeeId, contact, onClose }: { employeeId: string; contact: EmergencyContact | null; onClose: () => void }) {
  const { state, onSubmit, pending } = useFormAction(saveEmergencyContactAction);
  useActionFeedback(state, { onSuccess: onClose });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact ? "Edit emergency contact" : "Add emergency contact"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <FormError state={state} />
          <input type="hidden" name="employeeId" value={employeeId} />
          {contact && <input type="hidden" name="id" value={contact.id} />}
          <Field label="Name" name="name" error={fieldError(state, "name")} required>
            <Input defaultValue={contact?.name} />
          </Field>
          <Field label="Relationship" name="relationship" error={fieldError(state, "relationship")} required>
            <Input defaultValue={contact?.relationship} placeholder="Spouse, parent, sibling…" />
          </Field>
          <Field label="Phone" name="phone" error={fieldError(state, "phone")} required>
            <Input type="tel" defaultValue={contact?.phone} />
          </Field>
          <Field label="Email" name="email" error={fieldError(state, "email")}>
            <Input type="email" defaultValue={contact?.email ?? ""} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton pending={pending}>Save</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
