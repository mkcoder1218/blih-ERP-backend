import nodemailer from 'nodemailer';
import { smtpService } from '../modules/smtp/smtp.service';

async function createTransporter(businessId?: string) {
  if (businessId) {
    const resolved = await smtpService.resolveBusinessTransport(businessId);
    if (resolved) return { transporter: resolved.transporter, from: resolved.from };
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    // Fallback to Ethereal for dev/testing
    return null;
  }

  return {
    transporter: nodemailer.createTransport({ host, port, secure, auth: { user, pass } }),
    from: `"${process.env.SMTP_FROM_NAME || 'HR Team'}" <${process.env.SMTP_FROM_EMAIL || user}>`,
  };
}

async function getTransporter(businessId?: string) {
  const t = await createTransporter(businessId);
  if (t) return { ...t, isTest: false, testUser: null };

  console.warn('[InterviewMailer] SMTP credentials missing — using Ethereal test account');
  const testAccount = await nodemailer.createTestAccount();
  return {
    transporter: nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    }),
    from: `"${process.env.SMTP_FROM_NAME || 'HR Team'}" <${process.env.SMTP_FROM_EMAIL || testAccount.user}>`,
    isTest: true,
    testUser: testAccount.user,
  };
}

export interface InterviewInvitePayload {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  interviewAt: Date;
  duration: number; // minutes
  type: string;
  venue?: string;
  interviewerName?: string;
  acceptUrl: string;
  declineUrl: string;
  businessId?: string;
}

export async function sendInterviewInviteEmail(payload: InterviewInvitePayload): Promise<boolean> {
  const { transporter, isTest, from } = await getTransporter(payload.businessId);

  const dateStr = new Date(payload.interviewAt).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #1a1a2e; padding: 30px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 24px;">Interview Invitation</h1>
    </div>
    <div style="padding: 30px;">
      <p style="color: #333; font-size: 16px;">Dear <strong>${payload.candidateName}</strong>,</p>
      <p style="color: #555;">We are pleased to invite you for an interview for the position of <strong>${payload.jobTitle}</strong>.</p>
      
      <div style="background: #f8f9fa; border-left: 4px solid #1a1a2e; padding: 20px; margin: 20px 0; border-radius: 4px;">
        <h3 style="margin: 0 0 15px; color: #1a1a2e;">Interview Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #666; width: 40%;">📅 Date & Time:</td><td style="padding: 6px 0; color: #333; font-weight: bold;">${dateStr}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">⏱ Duration:</td><td style="padding: 6px 0; color: #333;">${payload.duration} minutes</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">📋 Format:</td><td style="padding: 6px 0; color: #333;">${payload.type}</td></tr>
          ${payload.venue ? `<tr><td style="padding: 6px 0; color: #666;">📍 Location:</td><td style="padding: 6px 0; color: #333;">${payload.venue}</td></tr>` : ''}
          ${payload.interviewerName ? `<tr><td style="padding: 6px 0; color: #666;">👤 Interviewer:</td><td style="padding: 6px 0; color: #333;">${payload.interviewerName}</td></tr>` : ''}
        </table>
      </div>

      <p style="color: #555;">Please confirm your attendance by clicking one of the buttons below:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${payload.acceptUrl}" style="display: inline-block; background: #22c55e; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 0 10px;">✓ Accept Interview</a>
        <a href="${payload.declineUrl}" style="display: inline-block; background: #ef4444; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 0 10px;">✗ Decline</a>
      </div>

      <p style="color: #888; font-size: 13px; border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px;">
        If you have any questions, please don't hesitate to contact our HR team.<br>
        This invitation link expires in 7 days.
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `Dear ${payload.candidateName},\n\nYou have been invited for an interview for ${payload.jobTitle}.\n\nDate: ${dateStr}\nDuration: ${payload.duration} minutes\nFormat: ${payload.type}${payload.venue ? `\nLocation: ${payload.venue}` : ''}\n\nAccept: ${payload.acceptUrl}\nDecline: ${payload.declineUrl}\n\nBest regards,\nHR Team`;

  const info = await transporter.sendMail({
    from,
    to: payload.candidateEmail,
    subject: `Interview Invitation — ${payload.jobTitle}`,
    text,
    html,
  });

  if (isTest) {
    console.log('[InterviewMailer] Test email preview:', nodemailer.getTestMessageUrl(info as any));
  }

  return true;
}

export interface InterviewNotificationPayload {
  interviewerName: string;
  interviewerEmail: string;
  candidateName: string;
  jobTitle: string;
  interviewAt: Date;
  duration: number;
  type: string;
  venue?: string;
  businessId?: string;
}

export async function sendInterviewerNotificationEmail(payload: InterviewNotificationPayload): Promise<boolean> {
  const { transporter, isTest, from } = await getTransporter(payload.businessId);

  const dateStr = new Date(payload.interviewAt).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #1a1a2e; padding: 30px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 24px;">You've Been Assigned an Interview</h1>
    </div>
    <div style="padding: 30px;">
      <p style="color: #333;">Hi <strong>${payload.interviewerName}</strong>,</p>
      <p style="color: #555;">You have been assigned to conduct an interview for the position of <strong>${payload.jobTitle}</strong>.</p>
      <div style="background: #f8f9fa; border-left: 4px solid #1a1a2e; padding: 20px; margin: 20px 0; border-radius: 4px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #666; width: 40%;">👤 Candidate:</td><td style="padding: 6px 0; color: #333; font-weight: bold;">${payload.candidateName}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">📅 Date & Time:</td><td style="padding: 6px 0; color: #333;">${dateStr}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">⏱ Duration:</td><td style="padding: 6px 0; color: #333;">${payload.duration} minutes</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">📋 Format:</td><td style="padding: 6px 0; color: #333;">${payload.type}</td></tr>
          ${payload.venue ? `<tr><td style="padding: 6px 0; color: #666;">📍 Location:</td><td style="padding: 6px 0; color: #333;">${payload.venue}</td></tr>` : ''}
        </table>
      </div>
      <p style="color: #555;">Please log in to the HR portal to review the candidate's profile and prepare your questions.</p>
    </div>
  </div>
</body>
</html>`;

  const info = await transporter.sendMail({
    from,
    to: payload.interviewerEmail,
    subject: `Interview Assignment — ${payload.candidateName} for ${payload.jobTitle}`,
    text: `Hi ${payload.interviewerName},\n\nYou have been assigned to interview ${payload.candidateName} for ${payload.jobTitle} on ${dateStr}.\n\nBest regards,\nHR Team`,
    html,
  });

  if (isTest) {
    console.log('[InterviewMailer] Interviewer notification preview:', nodemailer.getTestMessageUrl(info as any));
  }

  return true;
}
