"use client";
import { startTransition, useActionState, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-result";

/**
 * Like useActionState, but submits via onSubmit so React does not reset the form's fields after the
 * action runs — users keep what they typed when the server returns validation errors.
 */
export function useFormAction<T>(action: (prev: ActionResult<T> | null, fd: FormData) => Promise<ActionResult<T>>) {
  const [state, dispatch, pending] = useActionState(action, null);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  return { state, onSubmit, pending };
}
