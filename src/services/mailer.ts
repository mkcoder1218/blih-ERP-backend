/**
 * Blih ERP — Mailer Service
 * Thin wrapper around nodemailer. Uses SMTP creds from .env.
 * Falls back to console logging when SMTP is not configured (e.g. in test env).
 */
import nodemailer, { type Transporter } from "nodemailer";

function createTransport(): Transporter {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // Return a preview-only transport that logs to console
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const transport = createTransport();
const FROM = `"${process.env.SMTP_FROM_NAME || "Blih ERP"}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "noreply@blih.app"}>`;

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  try {
    const info = await transport.sendMail({ from: FROM, ...opts });
    if (process.env.SMTP_HOST) {
      console.log(`[Mailer] sent → ${opts.to} | msgId: ${info.messageId}`);
    } else {
      console.log(`[Mailer][preview] ${opts.subject} → ${opts.to}`);
      console.log(opts.html.replace(/<[^>]+>/g, "").trim().slice(0, 400));
    }
    return info;
  } catch (err) {
    console.error("[Mailer] Failed to send email:", err);
    // Non-fatal — callers should not crash on email failure
  }
}
