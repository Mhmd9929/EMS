"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

/** Toast the outcome of a useActionState action once per result. */
export function useActionFeedback(state: ActionResult<unknown> | null, opts: { onSuccess?: () => void; silentSuccess?: boolean } = {}) {
  const last = useRef<ActionResult<unknown> | null>(null);
  const { onSuccess, silentSuccess } = opts;
  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) {
      if (!silentSuccess && state.message) toast.success(state.message);
      onSuccess?.();
    } else {
      toast.error(state.error);
    }
  }, [state, onSuccess, silentSuccess]);
}

export function fieldError(state: ActionResult<unknown> | null, name: string) {
  return state && !state.ok ? state.fieldErrors?.[name] : undefined;
}
