import { sendMail } from "../../services/mailer";

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount)
    : "0";
}

function appBaseUrl() {
  return (
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    process.env.PUBLIC_APP_URL ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
}

export function employmentChangeReviewUrl(requestId: string) {
  return `${appBaseUrl()}/?employmentChangeRequestId=${encodeURIComponent(requestId)}`;
}

function requestSummaryHtml(request: any) {
  const rows: string[] = [];

  if (request.targetTitle) {
    rows.push(
      `<tr><td style="padding:7px 0;color:#64748b">Title</td><td style="padding:7px 0;font-weight:700">${esc(request.currentTitle || "—")} → ${esc(request.targetTitle)}</td></tr>`,
    );
  }

  if (request.requestedSalary != null) {
    const finalRequested = request.recommendedSalary ?? request.requestedSalary;
    const increase = Number(finalRequested || 0) - Number(request.currentSalary || 0);
    const pct = Number(request.currentSalary || 0) > 0
      ? (increase / Number(request.currentSalary)) * 100
      : 0;
    rows.push(
      `<tr><td style="padding:7px 0;color:#64748b">Salary</td><td style="padding:7px 0;font-weight:700">${money(request.currentSalary)} → ${money(finalRequested)} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)</td></tr>`,
    );
  }

  rows.push(
    `<tr><td style="padding:7px 0;color:#64748b">Effective date</td><td style="padding:7px 0;font-weight:700">${esc(request.effectiveDate)}</td></tr>`,
  );
  rows.push(
    `<tr><td style="padding:7px 0;color:#64748b">Reason</td><td style="padding:7px 0;font-weight:700">${esc(request.reason)}</td></tr>`,
  );

  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows.join("")}</table>`;
}

export async function sendEmploymentChangeReviewEmail(input: {
  to: string;
  approverName?: string | null;
  employeeName: string;
  requesterName: string;
  request: any;
}) {
  const { to, approverName, employeeName, requesterName, request } = input;
  const url = employmentChangeReviewUrl(request.id);
  const subject = `Review employment change request for ${employeeName}`;

  await sendMail({
    to,
    subject,
    text: `${requesterName} submitted an employment change request for ${employeeName}. Review it in Blih: ${url}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#0f172a">
        <h2 style="margin-bottom:6px">Employment change needs your review</h2>
        <p style="color:#475569">Hi ${esc(approverName || "Manager")}, ${esc(requesterName)} submitted a request for <strong>${esc(employeeName)}</strong>.</p>
        <div style="margin:18px 0;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc">
          ${requestSummaryHtml(request)}
        </div>
        <a href="${esc(url)}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:11px 18px;border-radius:10px;font-weight:700">Review Request</a>
        <p style="margin-top:18px;color:#94a3b8;font-size:12px">For security, approval and rejection are completed inside authenticated Blih ERP.</p>
      </div>
    `,
  });
}

export async function sendEmploymentChangeStatusEmail(input: {
  to: string;
  recipientName?: string | null;
  employeeName: string;
  request: any;
  heading: string;
  message: string;
}) {
  const { to, recipientName, employeeName, request, heading, message } = input;
  const url = employmentChangeReviewUrl(request.id);

  await sendMail({
    to,
    subject: `${heading}: ${employeeName}`,
    text: `${message} ${url}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#0f172a">
        <h2>${esc(heading)}</h2>
        <p style="color:#475569">Hi ${esc(recipientName || "there")}, ${esc(message)}</p>
        <div style="margin:18px 0;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc">
          ${requestSummaryHtml(request)}
        </div>
        <a href="${esc(url)}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:11px 18px;border-radius:10px;font-weight:700">Open in Blih</a>
      </div>
    `,
  });
}
