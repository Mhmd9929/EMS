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

type S = "INCLUDED" | "HELD" | "EXCLUDED";
const LABEL: Record<S, string> = { INCLUDED: "Included", HELD: "Held", EXCLUDED: "Excluded" };

export function EntryStatusMenu({ entryId, name, status, reason }: { entryId: string; name: string; status: S; reason: string | null }) {
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
          <Button variant="ghost" size="sm" className="h-7 px-1" aria-label={`Change status of ${name}`} title={reason ?? undefined}>
            <Badge variant={status === "INCLUDED" ? "success" : "secondary"}>{LABEL[status]} ▾</Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(["INCLUDED", "HELD", "EXCLUDED"] as S[])
            .filter((s) => s !== status)
            .map((s) => (
              <DropdownMenuItem key={s} onSelect={() => setTarget(s)}>
                {s === "INCLUDED" ? "Include in this run" : s === "HELD" ? "Hold salary (not paid this run)" : "Exclude from this run"}
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {target === "INCLUDED" ? "Include" : target === "HELD" ? "Hold" : "Exclude"} {name}
            </DialogTitle>
            <DialogDescription>Held and excluded employees are not in the WPS or bank files and get no payslip from this run.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4">
            <FormError state={state} />
            <input type="hidden" name="entryId" value={entryId} />
            <input type="hidden" name="status" value={target ?? ""} />
            {target !== "INCLUDED" && (
              <Field label="Reason" name="reason" error={fieldError(state, "reason")} required>
                <Input placeholder="e.g. Pending clearance, bank details wrong" />
              </Field>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTarget(null)}>
                Cancel
              </Button>
              <SubmitButton pending={pending}>Confirm</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
