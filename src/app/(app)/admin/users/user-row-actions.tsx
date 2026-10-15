"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, LogOut, MoreHorizontal, Send, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { adminResetPasswordAction, revokeSessionsAction, saveUserRolesAction, sendInviteAction, setUserActiveAction } from "@/server/actions/admin.actions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/input";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";
import type { ActionResult } from "@/lib/action-result";

type U = { id: string; name: string; isActive: boolean; activated: boolean; roleIds: string[] };

export function UserRowActions({ user, roles, isSelf }: { user: U; roles: { id: string; name: string; key: string }[]; isSelf: boolean }) {
  const router = useRouter();
  const [rolesOpen, setRolesOpen] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<{ link: string | null } | unknown>>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      const link = (r.data as { link?: string | null } | undefined)?.link;
      toast.success(r.message ?? "Done", link ? { description: `Dev link: ${link}`, duration: 20000 } : undefined);
      router.refresh();
    });
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${user.name}`} disabled={pending}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRolesOpen(true)}>
            <ShieldCheck aria-hidden /> Edit roles
          </DropdownMenuItem>
          {user.isActive && !user.activated && (
            <DropdownMenuItem onSelect={() => run(() => sendInviteAction(user.id))}>
              <Send aria-hidden /> Send invitation
            </DropdownMenuItem>
          )}
          {user.isActive && user.activated && (
            <DropdownMenuItem onSelect={() => run(() => adminResetPasswordAction(user.id))}>
              <KeyRound aria-hidden /> Send password reset
            </DropdownMenuItem>
          )}
          {user.isActive && (
            <DropdownMenuItem onSelect={() => run(() => revokeSessionsAction(user.id))}>
              <LogOut aria-hidden /> Sign out everywhere
            </DropdownMenuItem>
          )}
          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              {user.isActive ? (
                <DropdownMenuItem variant="destructive" onSelect={() => run(() => setUserActiveAction(user.id, false))}>
                  <UserX aria-hidden /> Disable login
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => run(() => setUserActiveAction(user.id, true))}>
                  <UserCheck aria-hidden /> Enable login
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
        <DialogContent>
          {rolesOpen && (
            <RolesForm
              user={user}
              roles={roles}
              onDone={() => {
                setRolesOpen(false);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RolesForm({ user, roles, onDone }: { user: U; roles: { id: string; name: string; key: string }[]; onDone: () => void }) {
  const { state, onSubmit, pending } = useFormAction(saveUserRolesAction);
  useActionFeedback(state, { onSuccess: onDone });
  return (
    <>
      <DialogHeader>
        <DialogTitle>Roles for {user.name}</DialogTitle>
        <DialogDescription>Effective permissions are the union of all selected roles. Changes apply on the user&apos;s next request.</DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormError state={state} />
        <input type="hidden" name="userId" value={user.id} />
        <fieldset className="grid gap-2">
          <legend className="sr-only">Roles</legend>
          {roles.map((r) => (
            <label key={r.id} className="hover:bg-accent flex items-center gap-3 rounded-md border p-2.5 text-sm">
              <Checkbox name="roleIds" value={r.id} defaultChecked={user.roleIds.includes(r.id)} />
              {r.name}
            </label>
          ))}
        </fieldset>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <SubmitButton pending={pending}>Save roles</SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}
