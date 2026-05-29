import nodemailer from 'nodemailer';

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

async function getTransporter() {
  const t = createTransporter();
  if (t) return { transporter: t, isTest: false };

  console.warn('[OnboardingMailer] SMTP credentials missing — using Ethereal test account');
  const testAccount = await nodemailer.createTestAccount();
  return {
    transporter: nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    }),
    isTest: true,
  };
}

export interface OnboardingInvitePayload {
  candidateName: string;
  candidateEmail: string;
  companyName: string;
  onboardingUrl: string;
  startDate?: string;
  positionTitle?: string;
}

export async function sendOnboardingInviteEmail(payload: OnboardingInvitePayload): Promise<void> {
  const { transporter, isTest } = await getTransporter();

  const fromName  = process.env.SMTP_FROM_NAME  || 'HR Team';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'hr@blih.app';

  const startDateStr = payload.startDate
    ? new Date(payload.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Onboarding Portal is Ready</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f1f5f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8,#0ea5e9);padding:40px 40px 32px;text-align:center;">
              <div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
                <span style="font-size:28px;">🚀</span>
              </div>
              <h1 style="color:#ffffff;font-size:24px;font-weight:900;margin:0 0 8px;letter-spacing:-0.5px;">
                Welcome to ${payload.companyName}!
              </h1>
              <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:0;">
                Your onboarding portal is ready
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 20px;">
                Dear <strong>${payload.candidateName}</strong>,
              </p>
              <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 24px;">
                We're excited to have you joining the team${payload.positionTitle ? ` as <strong>${payload.positionTitle}</strong>` : ''}. 
                Your personalized onboarding portal has been set up and is ready for you to complete.
              </p>

              ${startDateStr ? `
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
                <p style="color:#166534;font-size:13px;font-weight:700;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Your Start Date</p>
                <p style="color:#15803d;font-size:16px;font-weight:900;margin:0;">${startDateStr}</p>
              </div>
              ` : ''}

              <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 28px;">
                Please complete your onboarding before your start date. The portal will guide you through all the required steps including personal information, documents, and any assigned resources.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 32px;">
                <tr>
                  <td style="border-radius:12px;background:#1d4ed8;">
                    <a href="${payload.onboardingUrl}"
                       target="_blank"
                       style="display:inline-block;padding:16px 40px;font-family:Arial,sans-serif;font-size:15px;font-weight:900;color:#ffffff;text-decoration:none;border-radius:12px;background:#1d4ed8;letter-spacing:0.3px;">
                      Start My Onboarding →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Link fallback -->
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
                <p style="color:#64748b;font-size:12px;margin:0 0 6px;">Or copy this link into your browser:</p>
                <a href="${payload.onboardingUrl}" style="color:#1d4ed8;font-size:12px;word-break:break-all;font-weight:600;">${payload.onboardingUrl}</a>
              </div>

              <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0;">
                This link is unique to you. Please do not share it with others. If you have any questions, contact your HR team.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">
                © ${new Date().getFullYear()} ${payload.companyName} · Sent by HR Team
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Dear ${payload.candidateName},\n\nWelcome to ${payload.companyName}! Your onboarding portal is ready.\n\n${startDateStr ? `Your start date: ${startDateStr}\n\n` : ''}Please complete your onboarding at:\n${payload.onboardingUrl}\n\nBest regards,\nHR Team`;

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: payload.candidateEmail,
    subject: `🚀 Your Onboarding Portal is Ready — ${payload.companyName}`,
    html,
    text,
  });

  if (isTest) {
    console.log(`[OnboardingMailer] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  }
}
