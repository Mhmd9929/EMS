import { describe, expect, it } from "vitest";
import { darkTokens, lightTokens, palette } from "@/theme/brand";

/** WCAG 2.x relative luminance / contrast ratio. */
function rgb(hex: string) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** `color` at `alpha` over `base` (for tints such as bg-success/15). */
function mix(color: string, alpha: number, base: string) {
  const c = rgb(color);
  const b = rgb(base);
  return "#" + c.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, "0")).join("");
}

type Pair = [label: string, fg: string, bg: string];

function pairs(t: Record<string, string>): Pair[] {
  const out: Pair[] = [
    ["body text", t.foreground, t.background],
    ["card text", t["card-foreground"], t.card],
    ["popover text", t["popover-foreground"], t.popover],
    ["muted text on page", t["muted-foreground"], t.background],
    ["muted text on card", t["muted-foreground"], t.card],
    ["muted text on muted", t["muted-foreground"], t.muted],
    ["secondary button", t["secondary-foreground"], t.secondary],
    ["primary button", t["primary-foreground"], t.primary],
    ["primary button hover", t["primary-foreground"], t["primary-hover"]],
    ["link on page", t.link, t.background],
    ["link on card", t.link, t.card],
    ["link on hover/selected row", t.link, t.accent],
    ["link on muted", t.link, t.muted],
    ["link on primary/5 tint", t.link, mix(t.primary, 0.05, t.background)],
    ["text on hover/selected row", t["accent-foreground"], t.accent],
    ["destructive button", t["destructive-foreground"], t.destructive],
    ["sidebar item", t["sidebar-foreground"], t.sidebar],
    ["sidebar item hover", t["sidebar-foreground"], t["sidebar-accent"]],
    ["sidebar group label", t["sidebar-muted"], t.sidebar],
    ["sidebar active item", t["sidebar-active"], t.sidebar],
    ["sidebar active item on hover", t["sidebar-active"], t["sidebar-accent"]],
    ["dark header text", t["header-dark-foreground"], t["header-dark"]],
    ["light header text", t["header-light-foreground"], t["header-light"]],
    ["badge on primary", t["primary-foreground"], t.primary],
  ];
  for (const s of ["success", "warning", "info", "destructive"]) {
    out.push([`${s} text on page`, t[s], t.background]);
    out.push([`${s} text on card`, t[s], t.card]);
    out.push([`${s} badge (15% tint)`, t[s], mix(t[s], 0.15, t.card)]);
    out.push([`${s} alert (10% tint)`, t.foreground, mix(t[s], 0.1, t.background)]);
  }
  return out;
}

describe("brand contrast (WCAG AA, 4.5:1 for text)", () => {
  for (const [mode, tokens] of [
    ["light", lightTokens],
    ["dark", darkTokens],
  ] as const) {
    for (const [label, fg, bg] of pairs(tokens)) {
      it(`${mode}: ${label} (${fg} on ${bg})`, () => {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("gold text is only allowed on dark backgrounds", () => {
    expect(contrast(palette.gold, palette.white)).toBeLessThan(4.5); // documents why: never gold on white
    expect(contrast(palette.gold, palette.black)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.gold, palette.charcoal)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.goldDark, palette.white)).toBeGreaterThanOrEqual(4.5);
    expect(lightTokens.link).toBe(palette.goldDark);
  });

  it("focus ring is visible (≥ 3:1) on both themes thanks to the inner ring", () => {
    expect(Math.max(contrast(lightTokens.ring, lightTokens.background), contrast(lightTokens["ring-inner"], lightTokens.background))).toBeGreaterThanOrEqual(3);
    expect(contrast(darkTokens.ring, darkTokens.background)).toBeGreaterThanOrEqual(3);
  });

  it("warning is visibly different from the brand gold", () => {
    const hue = (hex: string) => {
      const [r, g, b] = rgb(hex).map((v) => v / 255);
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    expect(Math.abs(hue(lightTokens.warning) - hue(palette.gold))).toBeGreaterThan(20);
    expect(Math.abs(hue(darkTokens.warning) - hue(palette.gold))).toBeGreaterThan(20);
  });
});
