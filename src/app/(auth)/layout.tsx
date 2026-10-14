import { getTranslations } from "next-intl/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <div className="bg-muted/40 flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md text-sm font-bold" aria-hidden>
          HR
        </span>
        {t("tagline")}
      </div>
      <main className="bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">{children}</main>
    </div>
  );
}
