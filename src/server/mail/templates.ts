import "server-only";
import type { MailMessage } from "./index";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(company: string, title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Segoe UI,Arial,sans-serif;color:#18181b">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:32px">
<tr><td style="font-size:13px;color:#71717a;padding-bottom:8px">${escape(company)}</td></tr>
<tr><td style="font-size:20px;font-weight:600;padding-bottom:16px">${escape(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${escape(href)}" style="background:#18181b;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${escape(label)}</a></p>
<p style="font-size:12px;color:#71717a">If the button does not work, copy this link into your browser:<br>${escape(href)}</p>`;
}

export function inviteEmail(p: { to: string; name: string; company: string; link: string; expiresHours: number }): MailMessage {
  return {
    to: p.to,
    subject: `You're invited to ${p.company} HR portal`,
    html: layout(
      p.company,
      `Welcome, ${p.name}`,
      `<p>An account has been created for you on the ${escape(p.company)} employee portal. Set your password to get started.</p>
       ${button(p.link, "Set my password")}
       <p style="font-size:13px;color:#71717a">This link expires in ${p.expiresHours} hours.</p>`,
    ),
    text: `Welcome, ${p.name}.\n\nSet your password for the ${p.company} employee portal:\n${p.link}\n\nThis link expires in ${p.expiresHours} hours.`,
  };
}

export function passwordResetEmail(p: { to: string; name: string; company: string; link: string }): MailMessage {
  return {
    to: p.to,
    subject: "Reset your password",
    html: layout(
      p.company,
      "Password reset",
      `<p>Hi ${escape(p.name)}, we received a request to reset your password.</p>
       ${button(p.link, "Reset password")}
       <p style="font-size:13px;color:#71717a">This link expires in 1 hour. If you did not request it, you can ignore this email.</p>`,
    ),
    text: `Hi ${p.name},\n\nReset your password: ${p.link}\n\nThis link expires in 1 hour. If you did not request it, ignore this email.`,
  };
}

export function passwordChangedEmail(p: { to: string; name: string; company: string }): MailMessage {
  return {
    to: p.to,
    subject: "Your password was changed",
    html: layout(p.company, "Password changed", `<p>Hi ${escape(p.name)}, your password was just changed. If this wasn't you, contact HR immediately.</p>`),
    text: `Hi ${p.name}, your password was just changed. If this wasn't you, contact HR immediately.`,
  };
}

export function notificationEmail(p: { to: string; company: string; title: string; body: string; link: string | null }): MailMessage {
  return {
    to: p.to,
    subject: p.title,
    html: layout(p.company, p.title, `<p>${escape(p.body).replace(/\n/g, "<br>")}</p>${p.link ? button(p.link, "Open in HR Portal") : ""}`),
    text: `${p.body}${p.link ? `\n\n${p.link}` : ""}`,
  };
}
