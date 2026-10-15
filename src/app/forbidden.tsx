import Link from "next/link";
import { ShieldX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <ShieldX className="text-destructive size-12" aria-hidden />
      <h1 className="text-2xl font-semibold">403 — Access denied</h1>
      <p className="text-muted-foreground max-w-md text-sm">You don&apos;t have permission to view this page. If you think this is a mistake, contact HR.</p>
      <Link href="/dashboard" className={buttonVariants()}>
        Back to dashboard
      </Link>
    </div>
  );
}
