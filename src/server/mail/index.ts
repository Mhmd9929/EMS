import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/server/env";
import { readBrandAsset } from "@/server/brand-assets";

export type MailMessage = { to: string; subject: string; html: string; text: string };

let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  if (env.EMAIL_TRANSPORT === "console") return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE === "true",
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

/**
 * Send an email through the configured provider. In `console` mode the message is printed to the
 * server log instead (development). Failures are logged and never break the calling flow.
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  const transport = getTransport();
  if (!transport) {
    console.info(`\n[mail:console] To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`);
    return true;
  }
  try {
    // Inline brand logo referenced by the templates as cid:hsa-logo (skipped if the file isn't installed).
    const logo = message.html.includes("cid:hsa-logo") ? await readBrandAsset("full") : null;
    await transport.sendMail({
      from: env.EMAIL_FROM,
      ...message,
      attachments: logo ? [{ filename: "hsa-logo.png", content: logo, cid: "hsa-logo", contentDisposition: "inline" }] : undefined,
    });
    return true;
  } catch (error) {
    console.error("[mail] failed to send", message.to, message.subject, error);
    return false;
  }
}
