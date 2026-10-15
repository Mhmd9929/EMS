import "server-only";
import type { MailMessage } from "./index";
import { brand, palette } from "@/theme/brand";

/** Content-ID of the inline logo; sendMail attaches /public/brand/logo-full.png when a template uses it. */
export const LOGO_CID = "hsa-logo";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(company: string, title: string, bodyHtml: string) {
  const p = palette;
  return `<!doctype html><html><body style="margin:0;background:${p.gray100};font-family:Inter,Segoe UI,Arial,sans-serif;color:${p.black}">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="background:${p.white};border-radius:12px;overflow:hidden">
<tr><td style="background:${p.black};padding:20px 32px"><img src="cid:${LOGO_CID}" alt="${escape(brand.company)}" height="44" style="display:block;height:44px;border:0;color:${p.gold};font-size:16px;font-weight:600"></td></tr>
<tr><td style="background:${p.gold};height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 32px">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:${p.gray600};padding-bottom:8px">${escape(company)} · ${escape(brand.name)}</td></tr>
<tr><td style="font-size:20px;font-weight:600;padding-bottom:16px">${escape(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
</table></td></tr>
</table>
<p style="font-size:12px;color:${p.gray600};margin:16px 0 0">${escape(brand.company)}</p>
</td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  const p = palette;
  return `<p style="margin:24px 0"><a href="${escape(href)}" style="background:${p.gold};color:${p.black};font-weight:600;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${escape(label)}</a></p>
<p style="font-size:12px;color:${p.gray600}">If the button does not work, copy this link into your browser:<br>${escape(href)}</p>`;
}

export function inviteEmail(p: { to: string; name: string; company: string; link: string; expiresHours: number }): MailMessage {
  return {
    to: p.to,
    subject: `You're invited to the ${brand.name}`,
    html: layout(
      p.company,
      `Welcome, ${p.name}`,
      `<p>An account has been created for you on the ${escape(p.company)} employee portal. Set your password to get started.</p>
       ${button(p.link, "Set my password")}
       <p style="font-size:13px;color:${palette.gray600}">This link expires in ${p.expiresHours} hours.</p>`,
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
       <p style="font-size:13px;color:${palette.gray600}">This link expires in 1 hour. If you did not request it, you can ignore this email.</p>`,
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
    html: layout(p.company, p.title, `<p>${escape(p.body).replace(/\n/g, "<br>")}</p>${p.link ? button(p.link, `Open in ${brand.name}`) : ""}`),
    text: `${p.body}${p.link ? `\n\n${p.link}` : ""}`,
  };
}
