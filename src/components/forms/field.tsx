"use client";
import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Label + control + hint + error, wired up with aria attributes for accessibility. */
export function Field({
  label,
  name,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  name: string;
  error?: string[] | string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactElement<Record<string, unknown>>;
}) {
  // Unique per instance: the same field name can appear twice on a page (e.g. form + dialog).
  const id = `f-${name}-${React.useId().replace(/:/g, "")}`;
  const errorText = Array.isArray(error) ? error[0] : error;
  const describedBy = [hint ? `${id}-hint` : null, errorText ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive" aria-hidden>*</span>}
      </Label>
      {React.cloneElement(children, {
        id,
        name,
        "aria-invalid": errorText ? true : undefined,
        "aria-describedby": describedBy,
        required,
      })}
      {hint && !errorText && (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      {errorText && (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {errorText}
        </p>
      )}
    </div>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-xl border p-5">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {description && <p className="text-muted-foreground -mt-2 text-sm">{description}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
