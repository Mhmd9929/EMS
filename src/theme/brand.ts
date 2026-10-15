/**
 * HSA brand — the single source of truth for every colour, logo and name used by the portal,
 * the payslip PDF and the email templates. Change a value here and everything follows:
 *   - the web UI reads these as CSS variables (injected by the root layout via `brandCss()`),
 *   - Tailwind utilities (`bg-primary`, `text-link`, `bg-sidebar` …) map to those variables in globals.css,
 *   - the PDF and email renderers import the hex values directly.
 * tests/unit/brand-contrast.test.ts checks every text/background pair for WCAG AA (4.5:1).
 */

/** Raw brand palette (Hayel Saeed Anam & Co.). */
export const palette = {
  gold: "#D9B300", // primary brand colour; gold text ONLY on dark backgrounds
  goldBright: "#FCC917", // logo yellow: highlights, active states, focus rings
  goldDark: "#8A6F00", // gold TEXT on white / light backgrounds (AA)
  goldTint: "#FDFAEE", // very light gold wash for hovers / selected rows on light surfaces
  goldShade: "#2A2410", // dark gold wash for hovers / selected rows on dark surfaces
  black: "#0A0A0A", // sidebar, header, primary dark surfaces
  charcoal: "#1C1C1C", // cards and hover on dark surfaces
  white: "#FFFFFF",
  gray50: "#FAFAFA",
  gray100: "#F5F5F5",
  gray200: "#E5E5E5",
  gray300: "#D4D4D4",
  gray400: "#A3A3A3",
  gray500: "#737373",
  gray600: "#525252",
  gray700: "#404040",
  gray800: "#262626",
  gray850: "#2E2E2E",
} as const;

/** Semantic status colours — deliberately not gold, so a warning never looks like a brand accent. */
const status = {
  light: { success: "#166534", warning: "#B13A0B", info: "#1D4ED8", destructive: "#B91C1C" },
  dark: { success: "#4ADE80", warning: "#FB923C", info: "#60A5FA", destructive: "#F87171" },
} as const;

/** Which top-header style to use: "dark" (black bar) or "light" (white with a thin gold bottom border). */
export const HEADER_STYLE: "dark" | "light" = "dark";

export const brand = {
  name: "HSA Employee Portal",
  company: "Hayel Saeed Anam & Co.",
  shortName: "HSA",
  /** Files in /public/brand (served at these URLs; the PDF reads them from disk). */
  logos: { icon: "/brand/logo-icon.png", full: "/brand/logo-full.png", favicon: "/brand/favicon.ico" },
  /** Default colour for a newly created leave type, and for "someone else's leave" on calendars. */
  defaultLeaveTypeColor: palette.goldDark,
  neutralLeaveColor: palette.gray500,
  fonts: {
    latin: '"Inter Variable", "Inter"',
    arabic: '"IBM Plex Sans Arabic"',
  },
} as const;

/** Semantic tokens (shadcn/ui names + a few portal-specific ones). */
type Tokens = Record<string, string>;

export const lightTokens: Tokens = {
  background: palette.white,
  foreground: palette.black,
  card: palette.white,
  "card-foreground": palette.black,
  popover: palette.white,
  "popover-foreground": palette.black,
  primary: palette.gold,
  "primary-foreground": palette.black,
  "primary-hover": palette.goldBright,
  secondary: palette.gray50,
  "secondary-foreground": palette.black,
  muted: palette.gray50,
  "muted-foreground": palette.gray600,
  accent: palette.goldTint,
  "accent-foreground": palette.black,
  link: palette.goldDark,
  destructive: status.light.destructive,
  "destructive-foreground": palette.white,
  success: status.light.success,
  warning: status.light.warning,
  info: status.light.info,
  border: palette.gray200,
  input: palette.gray300,
  ring: palette.goldBright,
  "ring-inner": palette.black,
  overlay: "rgb(10 10 10 / 0.6)",
  sidebar: palette.black,
  "sidebar-foreground": palette.gray300,
  "sidebar-muted": palette.gray400,
  "sidebar-accent": palette.charcoal,
  "sidebar-active": palette.gold,
  "sidebar-border": palette.gray800,
  "header-dark": palette.black,
  "header-dark-foreground": palette.gray100,
  "header-light": palette.white,
  "header-light-foreground": palette.black,
  "chart-1": palette.gold,
  "chart-2": palette.goldDark,
  "chart-3": palette.goldBright,
  "chart-4": palette.gray600,
  "chart-5": palette.gray400,
};

export const darkTokens: Tokens = {
  ...lightTokens,
  background: palette.black,
  foreground: palette.gray100,
  card: palette.charcoal,
  "card-foreground": palette.gray100,
  popover: palette.charcoal,
  "popover-foreground": palette.gray100,
  secondary: palette.gray800,
  "secondary-foreground": palette.gray100,
  muted: palette.gray800,
  "muted-foreground": palette.gray400,
  accent: palette.goldShade,
  "accent-foreground": palette.gray100,
  link: palette.gold,
  destructive: status.dark.destructive,
  "destructive-foreground": palette.black,
  success: status.dark.success,
  warning: status.dark.warning,
  info: status.dark.info,
  border: palette.gray850,
  input: palette.gray700,
  "ring-inner": palette.black,
  overlay: "rgb(0 0 0 / 0.7)",
  "sidebar-border": palette.gray800,
  "header-light": palette.charcoal,
  "header-light-foreground": palette.gray100,
};

const toVars = (t: Tokens) =>
  Object.entries(t)
    .map(([k, v]) => `--${k}:${v};`)
    .join("");

/** CSS variables for both themes, injected once in the root layout. */
export function brandCss() {
  return `:root{${toVars(lightTokens)}--font-brand-latin:${brand.fonts.latin};--font-brand-arabic:${brand.fonts.arabic};}.dark{${toVars(darkTokens)}}`;
}
