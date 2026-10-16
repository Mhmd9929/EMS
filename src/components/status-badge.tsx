import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { createFormat } from "@/lib/format";

export function EmployeeStatusBadge({ status, lastWorkingDay }: { status: string; lastWorkingDay?: Date | null }) {
  const t = useTranslations("enums.employeeStatus");
  const f = createFormat(useLocale());
  if (status === "TERMINATED") return <Badge variant="destructive">{t("TERMINATED")}</Badge>;
  if (lastWorkingDay) return <Badge variant="warning">{t("leaving", { date: f.date(lastWorkingDay) })}</Badge>;
  if (status === "ON_LEAVE") return <Badge variant="secondary">{t("ON_LEAVE")}</Badge>;
  return <Badge variant="success">{t("ACTIVE")}</Badge>;
}
