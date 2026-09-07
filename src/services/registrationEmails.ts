/**
 * Email templates for self-registration approval/rejection workflow.
 */
import { sendMail } from "./mailer";

const APP_URL = process.env.APP_URL || "http://localhost:5173";

// ── Approval email ─────────────────────────────────────────────────────────────
export async function sendApprovalEmail(opts: {
  toEmail: string;
  toName: string;
  businessName: string;
}) {
  const { toEmail, toName, businessName } = opts;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;">
    <tr><td style="background:#2563eb;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;letter-spacing:-0.5px;">Welcome to ${businessName}!</h1>
    </td></tr>
    <tr><td style="background:#fff;border-radius:0 0 16px 16px;padding:36px 40px;border:1px solid #e2e8f0;border-top:none;">
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px">Hi <strong>${toName}</strong>,</p>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 24px">
        Great news! Your registration request has been <strong style="color:#16a34a">approved</strong> by HR.
        Your account is now active and you can sign in using the credentials you set during registration.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${APP_URL}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:13px 32px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.2px;">
          Sign In Now →
        </a>
      </div>
      <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:24px 0 0;text-align:center;">
        If you didn't register for an account, please ignore this email.
      </p>
    </td></tr>
    <tr><td style="padding:20px 0;text-align:center;">
      <p style="color:#cbd5e1;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin:0;">
        Powered by <span style="color:#64748b">Blih CORE</span>
      </p>
    </td></tr>
  </table>
</body>
</html>`;

  await sendMail({
    to: toEmail,
    subject: `✅ Your account at ${businessName} has been approved`,
    html,
    text: `Hi ${toName}, your registration at ${businessName} has been approved. Sign in at ${APP_URL}`,
  });
}

// ── Rejection email ────────────────────────────────────────────────────────────
export async function sendRejectionEmail(opts: {
  toEmail: string;
  toName: string;
  businessName: string;
  businessSlug: string;
  registrationToken: string;
  reason: string;
  templateMessage?: string;
}) {
  const { toEmail, toName, businessName, businessSlug, registrationToken, reason, templateMessage } = opts;
  const resubmitUrl = `${APP_URL}/register/${businessSlug}?resubmit=${registrationToken}`;
  const message = templateMessage || reason;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;">
    <tr><td style="background:#0f172a;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;letter-spacing:-0.5px;">${businessName}</h1>
      <p style="color:#94a3b8;margin:8px 0 0;font-size:13px;font-weight:600;">Registration Review</p>
    </td></tr>
    <tr><td style="background:#fff;border-radius:0 0 16px 16px;padding:36px 40px;border:1px solid #e2e8f0;border-top:none;">
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px">Hi <strong>${toName}</strong>,</p>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px">
        Thank you for submitting your registration. Unfortunately, your application could not be approved at this time.
      </p>

      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:18px 20px;margin:0 0 24px;">
        <p style="color:#9a3412;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;">Reason from HR</p>
        <p style="color:#7c2d12;font-size:14px;line-height:1.6;margin:0;">${message}</p>
      </div>

      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">
        You can update your application and resubmit it using the button below. Your previously entered information will be pre-filled for you.
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${resubmitUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:13px 32px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.2px;">
          Update &amp; Resubmit Application →
        </a>
      </div>

      <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:24px 0 0;text-align:center;">
        This link is unique to your application. If you have questions, contact HR directly.
      </p>
    </td></tr>
    <tr><td style="padding:20px 0;text-align:center;">
      <p style="color:#cbd5e1;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin:0;">
        Powered by <span style="color:#64748b">Blih CORE</span>
      </p>
    </td></tr>
  </table>
</body>
</html>`;

  await sendMail({
    to: toEmail,
    subject: `Action required: Update your ${businessName} registration`,
    html,
    text: `Hi ${toName}, your registration at ${businessName} needs updates. Reason: ${message}. Resubmit at: ${resubmitUrl}`,
  });
}
