import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "outline" }> = {
  PENDING: { label: "Pending", variant: "warning" },
  APPROVED: { label: "Approved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "secondary" },
  CANCELLATION_REQUESTED: { label: "Cancellation requested", variant: "outline" },
};

export const LEAVE_STATUSES = Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }));
/** Status codes, for filters: label them with `enums.leaveStatus.<code>`. */
export const LEAVE_STATUS_VALUES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED", "CANCELLATION_REQUESTED"] as const;

export function LeaveStatusBadge({ status }: { status: string }) {
  const t = useTranslations("enums.leaveStatus");
  const s = STATUS[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={s.variant}>{status in STATUS ? t(status as "PENDING") : s.label}</Badge>;
}

export function LeaveTypeLabel({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {name}
    </span>
  );
}
