import type { ActionResult } from "@/lib/action-result";
import { Alert } from "@/components/ui/alert";

export function FormError({ state }: { state: ActionResult<unknown> | null }) {
  if (!state || state.ok) return null;
  return <Alert variant="error">{state.error}</Alert>;
}
