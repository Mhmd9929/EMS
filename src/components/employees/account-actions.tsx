"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { KeyRound, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminResetPasswordAction, sendInviteAction } from "@/server/actions/admin.actions";
import type { ActionResult } from "@/lib/action-result";

/** Invite / reset buttons. Outside production the generated link is shown so demos work without email. */
export function AccountActions({ userId, activated }: { userId: string; activated: boolean }) {
  const [pending, start] = useTransition();
  const t = useTranslations("employees.accountActions");
  const tc = useTranslations("common");
  const run = (fn: () => Promise<ActionResult<{ link: string | null }>>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? tc("done"), r.data?.link ? { description: t("devLink", { link: r.data.link }), duration: 20000 } : undefined);
    });
  return activated ? (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => adminResetPasswordAction(userId))}>
      <KeyRound aria-hidden /> {t("sendReset")}
    </Button>
  ) : (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => sendInviteAction(userId))}>
      <Send aria-hidden /> {t("sendInvite")}
    </Button>
  );
}
