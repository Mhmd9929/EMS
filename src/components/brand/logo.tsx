"use client";
import { useState } from "react";
import { brand } from "@/theme/brand";
import { cn } from "@/lib/utils";

/**
 * HSA logo from /public/brand. `icon` = square mark, `full` = wide logo with the Arabic + English name.
 * Falls back to a text mark if the image file is missing, so the layout never shows a broken image.
 */
export function BrandLogo({ variant, className }: { variant: "icon" | "full"; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={cn("inline-flex items-center gap-2 font-semibold", className)} role="img" aria-label={brand.company}>
        <span className="bg-primary text-primary-foreground flex aspect-square h-full max-h-9 min-h-7 items-center justify-center rounded-md px-1 text-xs font-bold">{brand.shortName}</span>
        {variant === "full" && <span className="truncate text-sm">{brand.company}</span>}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset, no optimisation needed
    <img
      src={variant === "icon" ? brand.logos.icon : brand.logos.full}
      alt={brand.company}
      onError={() => setFailed(true)}
      className={cn("object-contain", variant === "icon" ? "aspect-square" : "w-auto", className)}
    />
  );
}
