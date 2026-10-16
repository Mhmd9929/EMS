import { getTranslations } from "next-intl/server";
import { BrandLogo } from "@/components/brand/logo";
import { BrandWaves } from "@/components/brand/waves";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";

/** Split layout: black brand panel with the HSA logo and gold waves, white panel with the form. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="dark bg-sidebar text-sidebar-foreground relative flex min-h-48 flex-col items-center justify-center overflow-hidden px-8 py-10 lg:min-h-screen">
        <BrandWaves className="pointer-events-none absolute inset-0 size-full" />
        <div className="relative flex flex-col items-center gap-5 text-center">
          <BrandLogo variant="full" className="h-20 max-w-full lg:h-28" />
          <div className="bg-primary h-0.5 w-16 rounded-full" aria-hidden />
          <p className="text-link text-sm font-semibold tracking-[0.2em] uppercase">{t("name")}</p>
          <p className="text-sidebar-muted max-w-xs text-sm">{t("tagline")}</p>
        </div>
      </section>
      <section className="bg-background relative flex items-center justify-center px-4 py-14 sm:px-8">
        <LanguageSwitcher variant="outline" className="absolute end-4 top-4" />
        <main className="w-full max-w-sm">{children}</main>
      </section>
    </div>
  );
}
