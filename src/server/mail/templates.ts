import "server-only";
import type { MailMessage } from "./index";
import { brand, palette } from "@/theme/brand";
import { isRtl, type AppLocale } from "@/i18n/config";
import { translatorFor } from "@/server/i18n";

/** Content-ID of the inline logo; sendMail attaches /public/brand/logo-full.png when a template uses it. */
export const LOGO_CID = "hsa-logo";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Tr = (key: string, values?: Record<string, string | number>) => string;
const tr = async (locale: AppLocale) => (await translatorFor(locale, "emails")) as unknown as Tr;

function layout(locale: AppLocale, company: string, title: string, bodyHtml: string) {
  const p = palette;
  const dir = isRtl(locale) ? "rtl" : "ltr";
  const align = dir === "rtl" ? "right" : "left";
  return `<!doctype html><html lang="${locale}" dir="${dir}"><body style="margin:0;background:${p.gray100};font-family:Inter,'IBM Plex Sans Arabic',Segoe UI,Tahoma,Arial,sans-serif;color:${p.black}">
<table width="100%" cellpadding="0" cellspacing="0" dir="${dir}"><tr><td align="center" style="padding:32px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="background:${p.white};border-radius:12px;overflow:hidden">
<tr><td style="background:${p.black};padding:20px 32px;text-align:${align}"><img src="cid:${LOGO_CID}" alt="${escape(brand.company)}" height="44" style="display:inline-block;height:44px;border:0;color:${p.gold};font-size:16px;font-weight:600"></td></tr>
<tr><td style="background:${p.gold};height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 32px;text-align:${align}">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:${p.gray600};padding-bottom:8px">${escape(company)} · ${escape(brand.name)}</td></tr>
<tr><td style="font-size:20px;font-weight:600;padding-bottom:16px">${escape(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
</table></td></tr>
</table>
<p style="font-size:12px;color:${p.gray600};margin:16px 0 0">${escape(brand.company)}</p>
</td></tr></table></body></html>`;
}

function button(t: Tr, href: string, label: string) {
  const p = palette;
  return `<p style="margin:24px 0"><a href="${escape(href)}" style="background:${p.gold};color:${p.black};font-weight:600;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${escape(label)}</a></p>
<p style="font-size:12px;color:${p.gray600}">${escape(t("layout.buttonFallback"))}<br><span dir="ltr">${escape(href)}</span></p>`;
}

/** Emails are written in the recipient's saved language (User.locale), English by default. */
export async function inviteEmail(p: { to: string; name: string; company: string; link: string; expiresHours: number; locale?: AppLocale }): Promise<MailMessage> {
  const locale = p.locale ?? "en";
  const t = await tr(locale);
  return {
    to: p.to,
    subject: t("invite.subject", { portal: brand.name }),
    html: layout(
      locale,
      p.company,
      t("invite.title", { name: p.name }),
      `<p>${escape(t("invite.body", { company: p.company }))}</p>
       ${button(t, p.link, t("invite.button"))}
       <p style="font-size:13px;color:${palette.gray600}">${escape(t("invite.expires", { hours: p.expiresHours }))}</p>`,
    ),
    text: t("invite.text", { name: p.name, company: p.company, link: p.link, hours: p.expiresHours }),
  };
}

export async function passwordResetEmail(p: { to: string; name: string; company: string; link: string; locale?: AppLocale }): Promise<MailMessage> {
  const locale = p.locale ?? "en";
  const t = await tr(locale);
  return {
    to: p.to,
    subject: t("reset.subject"),
    html: layout(
      locale,
      p.company,
      t("reset.title"),
      `<p>${escape(t("reset.body", { name: p.name }))}</p>
       ${button(t, p.link, t("reset.button"))}
       <p style="font-size:13px;color:${palette.gray600}">${escape(t("reset.expires"))}</p>`,
    ),
    text: t("reset.text", { name: p.name, link: p.link }),
  };
}

export async function passwordChangedEmail(p: { to: string; name: string; company: string; locale?: AppLocale }): Promise<MailMessage> {
  const locale = p.locale ?? "en";
  const t = await tr(locale);
  const body = t("changed.body", { name: p.name });
  return { to: p.to, subject: t("changed.subject"), html: layout(locale, p.company, t("changed.title"), `<p>${escape(body)}</p>`), text: body };
}

/** Title and body are already in the recipient's language (rendered when the notification was created). */
export async function notificationEmail(p: { to: string; company: string; title: string; body: string; link: string | null; locale?: AppLocale }): Promise<MailMessage> {
  const locale = p.locale ?? "en";
  const t = await tr(locale);
  return {
    to: p.to,
    subject: p.title,
    html: layout(locale, p.company, p.title, `<p>${escape(p.body).replace(/\n/g, "<br>")}</p>${p.link ? button(t, p.link, t("layout.openPortal", { portal: brand.name })) : ""}`),
    text: `${p.body}${p.link ? `\n\n${p.link}` : ""}`,
  };
}
