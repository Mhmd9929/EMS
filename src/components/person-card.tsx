"use client";
import Link from "next/link";
import { Mail, MapPin, Building2, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";

export type PersonCardData = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  title: string | null;
  department: string | null;
  location?: string | null;
  email: string;
  manager?: string | null;
  hasPhoto: boolean;
  canOpenProfile: boolean;
};

/** Non-sensitive employee card shown from the directory and the org chart. */
export function PersonCardDialog({ person, onClose, extra }: { person: PersonCardData | null; onClose: () => void; extra?: React.ReactNode }) {
  const [first, ...rest] = (person?.name ?? "").split(" ");
  return (
    <Dialog open={!!person} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {person && (
          <>
            <DialogHeader className="items-center text-center">
              <Avatar employeeId={person.id} hasPhoto={person.hasPhoto} firstName={person.firstName ?? first} lastName={person.lastName ?? rest.at(-1)} size={80} />
              <DialogTitle>{person.name}</DialogTitle>
              <DialogDescription>{person.title ?? "—"}</DialogDescription>
            </DialogHeader>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="text-muted-foreground size-4" aria-hidden />
                <a href={`mailto:${person.email}`} className="hover:underline">
                  {person.email}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Building2 className="text-muted-foreground size-4" aria-hidden />
                {person.department ?? "—"}
              </li>
              {person.location !== undefined && (
                <li className="flex items-center gap-2">
                  <MapPin className="text-muted-foreground size-4" aria-hidden />
                  {person.location ?? "—"}
                </li>
              )}
              {person.manager !== undefined && (
                <li className="flex items-center gap-2">
                  <UserRound className="text-muted-foreground size-4" aria-hidden />
                  Reports to {person.manager ?? "—"}
                </li>
              )}
            </ul>
            {extra}
            {person.canOpenProfile && (
              <Link href={`/employees/${person.id}`} className={buttonVariants({ variant: "outline", className: "w-full" })}>
                Open full profile
              </Link>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
