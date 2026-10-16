"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { removePhotoAction, uploadPhotoAction } from "@/server/actions/employee.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/confirm-action";

export function PhotoUpload({ employeeId, hasPhoto }: { employeeId: string; hasPhoto: boolean }) {
  const router = useRouter();
  const t = useTranslations("employees.photo");
  const formRef = useRef<HTMLFormElement>(null);
  const { state, onSubmit, pending } = useFormAction(uploadPhotoAction);
  useActionFeedback(state, { onSuccess: () => router.refresh() });
  return (
    <div className="space-y-2">
      <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="employeeId" value={employeeId} />
        <label className="sr-only" htmlFor={`photo-${employeeId}`}>
          {t("label")}
        </label>
        <input
          id={`photo-${employeeId}`}
          name="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="text-muted-foreground file:bg-secondary file:text-foreground max-w-full text-sm file:me-2 file:rounded-md file:border-0 file:px-3 file:py-1.5"
          onChange={() => formRef.current?.requestSubmit()}
          disabled={pending}
        />
        <noscript>
          <Button type="submit" size="sm">
            <Upload aria-hidden /> {t("upload")}
          </Button>
        </noscript>
      </form>
      <p className="text-muted-foreground text-xs">{t("hint")}</p>
      {hasPhoto && (
        <ConfirmAction
          trigger={
            <Button variant="link" size="sm" className="h-auto px-0">
              {t("remove")}
            </Button>
          }
          title={t("removeTitle")}
          destructive
          confirmLabel={t("removeConfirm")}
          action={() => removePhotoAction(employeeId)}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  );
}
