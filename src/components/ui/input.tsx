import * as React from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 file:border-0 file:bg-transparent file:text-sm file:font-medium";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(inputClass, "h-auto min-h-20 py-2", className)} {...props} />;
}

/** Styled native <select>: accessible, keyboard friendly and works with FormData. */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select data-slot="select" className={cn(inputClass, "appearance-auto pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return <input type="checkbox" className={cn("size-4 rounded border-input accent-primary", className)} {...props} />;
}
