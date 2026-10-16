"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckSquare, X } from "lucide-react";
import { decideLeaveAction } from "@/server/actions/leave.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Card } from "@/components/ui/card";
import { Checkbox, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { EmptyState } from "@/components/empty-state";
import { LeaveTypeLabel } from "@/components/leave/leave-badges";
import { parseDateOnly } from "@/lib/dates";
import { useTranslations } from "next-intl";
import { useFormat } from "@/components/i18n/use-format";
import { useTimeAgo } from "@/components/layout/notification-bell";

type Item = {
  id: string;
  kind: "REQUEST" | "CANCELLATION";
  stepLabel: string;
  approverName: string | null;
  onBehalfOf: string | null;
  waitingSince: string;
  employee: { id: string; name: string; firstName: string; lastName: string; hasPhoto: boolean; title: string | null; department: string | null };
  type: { name: string; color: string };
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  cancellationReason: string | null;
};

export function InboxTable({ items, readOnly }: { items: Item[]; readOnly?: boolean }) {
  const timeAgo = useTimeAgo();
  const t = useTranslations("leave.approvals");
  const tc = useTranslations("common");
  const f = useFormat();
  const fd = (s: string) => f.date(parseDateOnly(s));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<null | "APPROVED" | "REJECTED">(null);
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = items.length > 0 && selected.size === items.length;
  // The dialog stays mounted when the list empties, so its success toast still shows.
  const bulkDialog = dialog && (
    <BulkDialog
      decision={dialog}
      ids={[...selected]}
      onClose={(done) => {
        setDialog(null);
        if (done) setSelected(new Set());
      }}
    />
  );
  return (
    <>
      {!items.length && <EmptyState icon={CheckSquare} title={t("emptyTitle")} description={t("emptyDescription")} />}
      {!readOnly && items.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))} aria-label={t("selectAll")} />{" "}
            {t("selectAll")}
          </label>
          <span className="text-muted-foreground text-sm">{t("selectedCount", { count: selected.size })}</span>
          <Button size="sm" disabled={!selected.size} onClick={() => setDialog("APPROVED")}>
            <Check aria-hidden /> {t("approveSelected")}
          </Button>
          <Button size="sm" variant="outline" disabled={!selected.size} onClick={() => setDialog("REJECTED")}>
            <X aria-hidden /> {t("rejectSelected")}
          </Button>
        </div>
      )}
      {items.length > 0 && (
        <Card className="divide-y py-0">
          {items.map((i) => (
            <div key={i.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              {!readOnly && <Checkbox checked={selected.has(i.id)} onChange={() => toggle(i.id)} aria-label={t("selectRequest", { name: i.employee.name })} />}
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar employeeId={i.employee.id} hasPhoto={i.employee.hasPhoto} firstName={i.employee.firstName} lastName={i.employee.lastName} size={40} />
                <div className="min-w-0">
                  <p className="font-medium">
                    <Link href={`/leave/requests/${i.id}`} className="hover:underline">
                      {i.employee.name}
                    </Link>
                    {i.kind === "CANCELLATION" && (
                      <Badge variant="outline" className="ms-2">
                        {t("cancellationRequest")}
                      </Badge>
                    )}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {i.employee.title ?? "—"} · {i.employee.department ?? "—"}
                  </p>
                </div>
              </div>
              <div className="text-sm sm:w-64">
                <LeaveTypeLabel name={i.type.name} color={i.type.color} className="font-medium" />
                <p className="text-muted-foreground">
                  {fd(i.startDate)}
                  {i.endDate !== i.startDate && ` – ${fd(i.endDate)}`} · {tc("days", { count: i.days })}
                </p>
                {(i.cancellationReason || i.reason) && (
                  <p className="text-muted-foreground line-clamp-1 text-xs">“{i.kind === "CANCELLATION" ? i.cancellationReason : i.reason}”</p>
                )}
              </div>
              <div className="text-muted-foreground text-xs sm:w-40 sm:text-end">
                <p>
                  {i.onBehalfOf ? t("stepFor", { role: i.stepLabel, name: i.onBehalfOf }) : t("step", { role: i.stepLabel })}
                </p>
                <p>{t("waiting", { ago: timeAgo(i.waitingSince) })}</p>
              </div>
              <Link href={`/leave/requests/${i.id}`} className="text-link text-sm hover:underline sm:w-16 sm:text-end">
                {t("review")}
              </Link>
            </div>
          ))}
        </Card>
      )}
      {bulkDialog}
    </>
  );
}

function BulkDialog({ decision, ids, onClose }: { decision: "APPROVED" | "REJECTED"; ids: string[]; onClose: (done: boolean) => void }) {
  const router = useRouter();
  const t = useTranslations("leave.approvals");
  const tc = useTranslations("common");
  const { state, onSubmit, pending } = useFormAction(decideLeaveAction);
  useActionFeedback(state, {
    onSuccess: () => {
      onClose(true);
      router.refresh();
    },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(decision === "APPROVED" ? "bulkApproveTitle" : "bulkRejectTitle", { count: ids.length })}
          </DialogTitle>
          <DialogDescription>{t("bulkDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <FormError state={state} />
          {ids.map((id) => (
            <input key={id} type="hidden" name="requestIds" value={id} />
          ))}
          <input type="hidden" name="decision" value={decision} />
          <Field label={tc("comment")} name="comment" error={fieldError(state, "comment")} required={decision === "REJECTED"}>
            <Textarea rows={2} maxLength={1000} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pending={pending} variant={decision === "APPROVED" ? "default" : "destructive"}>
              {decision === "APPROVED" ? t("approve") : t("reject")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
