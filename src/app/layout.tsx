import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Providers } from "@/components/layout/providers";
import { RTL_LOCALES } from "@/i18n/request";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "HR Portal", template: "%s · HR Portal" },
  description: "Employee Management Portal",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={RTL_LOCALES.includes(locale) ? "rtl" : "ltr"} suppressHydrationWarning>
      <body className="font-sans">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
