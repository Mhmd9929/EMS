import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";

export function EmployeeStatusBadge({ status, lastWorkingDay }: { status: string; lastWorkingDay?: Date | null }) {
  if (status === "TERMINATED") return <Badge variant="destructive">Terminated</Badge>;
  if (lastWorkingDay) return <Badge variant="warning">Leaving {formatDate(lastWorkingDay)}</Badge>;
  if (status === "ON_LEAVE") return <Badge variant="secondary">On leave</Badge>;
  return <Badge variant="success">Active</Badge>;
}
