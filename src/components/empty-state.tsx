import { Inbox } from "lucide-react";
import { useTranslations } from "next-intl";

export function EmptyState({ title, description, action, icon: Icon = Inbox }: { title?: string; description?: string; action?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  const t = useTranslations("common");
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
      <Icon className="text-muted-foreground size-8" aria-hidden />
      <p className="font-medium">{title ?? t("empty.title")}</p>
      {description && <p className="text-muted-foreground max-w-sm text-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
