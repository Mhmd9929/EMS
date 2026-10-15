"use client";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { approveSettlementAction } from "@/server/actions/payroll.actions";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/confirm-action";

export function ApproveSettlementButton({ settlementId, employeeId, name, total }: { settlementId: string; employeeId: string; name: string; total: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button size="sm" variant="outline" aria-label={`Approve settlement for ${name}`}>
          <Check aria-hidden /> Approve
        </Button>
      }
      title={`Approve final settlement for ${name}?`}
      description={`Total payable ${total}. The settlement is locked once approved.`}
      confirmLabel="Approve"
      action={() => approveSettlementAction(settlementId, employeeId)}
      onDone={() => router.refresh()}
    />
  );
}
