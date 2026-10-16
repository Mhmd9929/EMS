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
import { parseDateOnly } from "@/lib/dates";
import { useTranslations } from "next-intl";
import { useFormat } from "@/components/i18n/use-format";

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
  const t = useTranslations("leave.delegations");
  const tc = useTranslations("common");
  const f = useFormat();
  const fd = (s: string) => f.date(parseDateOnly(s));
  const { state, onSubmit, pending } = useFormAction(createDelegationAction);
  useActionFeedback(state, { onSuccess: () => router.refresh() });
  const status = (g: (typeof given)[number]) => (!g.isActive ? "ended" : g.end < today ? "expired" : g.start > today ? "scheduled" : "active");
  return (
    <Card className="mt-10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCheck className="size-4" aria-hidden /> {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={onSubmit} className="grid gap-3">
          <FormError state={state} />
          <Field label={t("delegate")} name="delegateId" error={fieldError(state, "delegateId")} required>
            <NativeSelect defaultValue="">
              <option value="" disabled>
                {t("chooseColleague")}
              </option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tc("from")} name="startDate" error={fieldError(state, "startDate")} required>
              <Input type="date" defaultValue={today} min={today} />
            </Field>
            <Field label={t("until")} name="endDate" error={fieldError(state, "endDate")} required>
              <Input type="date" min={today} />
            </Field>
          </div>
          <Field label={t("note")} name="reason" error={fieldError(state, "reason")}>
            <Input placeholder={t("notePlaceholder")} maxLength={300} />
          </Field>
          <div>
            <SubmitButton pending={pending}>{t("submit")}</SubmitButton>
          </div>
        </form>
        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-2 font-medium">{t("mine")}</p>
            {given.length === 0 ? (
              <p className="text-muted-foreground">{t("none")}</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {given.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2 p-2.5">
                    <span>
                      {g.delegate} <span className="text-muted-foreground">· {fd(g.start)} – {fd(g.end)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant={status(g) === "active" ? "success" : "secondary"}>{t(`status.${status(g)}`)}</Badge>
                      {g.isActive && g.end >= today && (
                        <ConfirmAction
                          trigger={
                            <Button variant="ghost" size="sm">
                              {t("end")}
                            </Button>
                          }
                          title={t("endTitle", { name: g.delegate })}
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
              <p className="mb-2 font-medium">{t("received")}</p>
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
