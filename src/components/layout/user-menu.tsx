"use client";
import Link from "next/link";
import { KeyRound, Languages, LogOut, UserCircle } from "lucide-react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/server/actions/locale.actions";
import { LOCALE_LABELS } from "@/i18n/config";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { logoutAction } from "@/server/actions/auth.actions";

export function UserMenu({
  name,
  email,
  roles,
  employeeId,
  photoPath,
  labels,
}: {
  name: string;
  email: string;
  roles: string[];
  employeeId: string | null;
  photoPath: string | null;
  labels: { profile: string; changePassword: string; signOut: string; accountMenu: string };
}) {
  const [first, ...rest] = name.split(" ");
  const locale = useLocale();
  const router = useRouter();
  const other = locale === "ar" ? "en" : "ar";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-accent flex items-center gap-2 rounded-full p-0.5 pe-2 outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={labels.accountMenu}>
        <Avatar employeeId={employeeId} hasPhoto={!!photoPath} version={photoPath} firstName={first} lastName={rest.at(-1)} size={32} />
        <span className="hidden max-w-36 truncate text-sm font-medium sm:inline">{name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <p className="truncate">{name}</p>
          <p className="text-muted-foreground truncate text-xs font-normal">{email}</p>
          <p className="text-muted-foreground mt-1 text-xs font-normal">{roles.join(" · ")}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {employeeId && (
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <UserCircle aria-hidden /> {labels.profile}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/profile/password">
            <KeyRound aria-hidden /> {labels.changePassword}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem lang={other} onSelect={async () => (await setLocaleAction(other), router.refresh())}>
          <Languages aria-hidden /> {LOCALE_LABELS[other]}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden /> {labels.signOut}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
