"use client";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";
import { createDelegationAction, revokeDelegationAction } from "@/server/actions/leave.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/confirm-action";
import { formatDate, parseDateOnly } from "@/lib/dates";

const fd = (s: string) => formatDate(parseDateOnly(s));

export function Delegations({
  given,
  received,
  options,
  today,
}: {
  given: { id: string; delegate: string; start: string; end: string; reason: string | null; isActive: boolean }[];
  received: { id: string; delegator: string; start: string; end: string }[];
  options: { value: string; label: string }[];
  today: string;
}) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(createDelegationAction);
  useActionFeedback(state, { onSuccess: () => router.refresh() });
  const status = (g: (typeof given)[number]) => (!g.isActive ? "Ended" : g.end < today ? "Expired" : g.start > today ? "Scheduled" : "Active");
  return (
    <Card className="mt-10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCheck className="size-4" aria-hidden /> Delegation
        </CardTitle>
        <CardDescription>Away? Let a colleague approve leave for your team during a period. HR can always step in.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={onSubmit} className="grid gap-3">
          <FormError state={state} />
          <Field label="Delegate" name="delegateId" error={fieldError(state, "delegateId")} required>
            <NativeSelect defaultValue="">
              <option value="" disabled>
                Choose a colleague…
              </option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" name="startDate" error={fieldError(state, "startDate")} required>
              <Input type="date" defaultValue={today} min={today} />
            </Field>
            <Field label="Until" name="endDate" error={fieldError(state, "endDate")} required>
              <Input type="date" min={today} />
            </Field>
          </div>
          <Field label="Note" name="reason" error={fieldError(state, "reason")}>
            <Input placeholder="e.g. Annual leave" maxLength={300} />
          </Field>
          <div>
            <SubmitButton pending={pending}>Delegate approvals</SubmitButton>
          </div>
        </form>
        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-2 font-medium">My delegations</p>
            {given.length === 0 ? (
              <p className="text-muted-foreground">None.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {given.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2 p-2.5">
                    <span>
                      {g.delegate} <span className="text-muted-foreground">· {fd(g.start)} – {fd(g.end)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant={status(g) === "Active" ? "success" : "secondary"}>{status(g)}</Badge>
                      {g.isActive && g.end >= today && (
                        <ConfirmAction
                          trigger={
                            <Button variant="ghost" size="sm">
                              End
                            </Button>
                          }
                          title={`End delegation to ${g.delegate}?`}
                          action={() => revokeDelegationAction(g.id)}
                          onDone={() => router.refresh()}
                        />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {received.length > 0 && (
            <div>
              <p className="mb-2 font-medium">Delegated to me</p>
              <ul className="space-y-1">
                {received.map((r) => (
                  <li key={r.id}>
                    {r.delegator} <span className="text-muted-foreground">· {fd(r.start)} – {fd(r.end)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
