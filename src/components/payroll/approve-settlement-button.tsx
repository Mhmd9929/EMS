"use client";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { approveSettlementAction } from "@/server/actions/payroll.actions";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/confirm-action";
import { useTranslations } from "next-intl";

export function ApproveSettlementButton({ settlementId, employeeId, name, total }: { settlementId: string; employeeId: string; name: string; total: string }) {
  const router = useRouter();
  const t = useTranslations("payroll.approveSettlement");
  return (
    <ConfirmAction
      trigger={
        <Button size="sm" variant="outline" aria-label={t("label", { name })}>
          <Check aria-hidden /> {t("button")}
        </Button>
      }
      title={t("title", { name })}
      description={t("description", { total })}
      confirmLabel={t("confirm")}
      action={() => approveSettlementAction(settlementId, employeeId)}
      onDone={() => router.refresh()}
    />
  );
}
