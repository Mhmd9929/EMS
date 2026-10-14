import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";

const styles = {
  info: { cls: "border-primary/30 bg-primary/5", Icon: Info },
  success: { cls: "border-success/30 bg-success/10", Icon: CheckCircle2 },
  warning: { cls: "border-warning/40 bg-warning/10", Icon: TriangleAlert },
  error: { cls: "border-destructive/30 bg-destructive/10 text-destructive", Icon: AlertCircle },
};

export function Alert({ variant = "info", title, children, className }: { variant?: keyof typeof styles; title?: string; children?: React.ReactNode; className?: string }) {
  const { cls, Icon } = styles[variant];
  return (
    <div role={variant === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border p-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(variant !== "error" && "text-muted-foreground")}>{children}</div>}
      </div>
    </div>
  );
}
