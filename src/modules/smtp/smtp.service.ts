import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { env } from "../../config/env";
import { db } from "../../models";
import { decryptCredential, encryptCredential, maskSecret } from "../../utils/credentialCrypto";

type ProviderInput = {
  name: string;
  smtpHost: string;
  smtpPort: number;
  encryptionType?: string;
  secureConnection?: boolean;
  isActive?: boolean;
  appPasswordRequired?: boolean;
  instructions?: string | null;
};

type BusinessSmtpInput = {
  providerId: string;
  senderEmail: string;
  smtpUsername: string;
  smtpPassword?: string;
  appPassword?: string;
  senderName: string;
  isActive?: boolean;
  testRecipientEmail?: string;
};

type PunctualityTestEmailInput = {
  testRecipientEmail: string;
  subject: string;
  body: string;
};

function sanitizeProvider(provider: any) {
  if (!provider) return null;
  const plain = typeof provider.toJSON === "function" ? provider.toJSON() : provider;
  return plain;
}

function passwordFromInput(input: BusinessSmtpInput) {
  return input.appPassword || input.smtpPassword || "";
}

function smtpError(message: string, details?: unknown, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode, details });
}

function assertEmail(value: string, label = "email address") {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim())) {
    throw smtpError(`Enter a valid ${label}.`);
  }
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildTransportOptions(provider: any, auth: { user: string; pass: string }): SMTPTransport.Options {
  const host = String(provider.smtpHost || "").trim();
  const port = Number(provider.smtpPort);
  const encryptionType = String(provider.encryptionType || "").toLowerCase();
  const usesImplicitTls = port === 465 || encryptionType.includes("ssl") || encryptionType.includes("implicit");
  const usesStartTls = !usesImplicitTls && (port === 587 || encryptionType.includes("starttls") || Boolean(provider.secureConnection));
  const rejectUnauthorized = env.nodeEnv === "production" ? true : env.smtpTlsRejectUnauthorized;

  return {
    host,
    port,
    secure: usesImplicitTls,
    requireTLS: usesStartTls,
    auth,
    tls: {
      servername: host,
      minVersion: "TLSv1.2" as const,
      rejectUnauthorized,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  };
}

function describeSmtpVerifyFailure(error: any, provider?: any) {
  const code = error?.code || error?.command || "SMTP_CONNECTION_FAILED";
  const port = provider?.smtpPort ? Number(provider.smtpPort) : null;
  const providerName = provider?.name ? String(provider.name) : "selected provider";
  const baseDetails = {
    code,
    provider: providerName,
    host: provider?.smtpHost || null,
    port,
    encryptionType: provider?.encryptionType || null,
    secureConnection: provider?.secureConnection ?? null,
  };

  if (code === "ECONNRESET" || /ECONNRESET|socket|connection/i.test(String(error?.message || ""))) {
    return smtpError(
      `The SMTP server closed the connection. Check that ${providerName} uses the correct SMTP port and security setting. Use port 465 for SSL/TLS, or port 587 for STARTTLS.`,
      baseDetails
    );
  }

  if (code === "EAUTH" || /auth|login|credentials|username|password/i.test(String(error?.message || ""))) {
    if (/hostinger/i.test(providerName) || /hostinger/i.test(String(provider?.smtpHost || ""))) {
      return smtpError(
        "Hostinger rejected the SMTP login. Use the full mailbox email address as the SMTP username, and use that mailbox password. Do not use the Hostinger account/hPanel password unless it is also the mailbox password.",
        baseDetails
      );
    }

    return smtpError(
      "SMTP authentication failed. Check the email username and password. If this provider requires an app password, use the app password instead of the normal account password.",
      baseDetails
    );
  }

  if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT" || /timed out/i.test(String(error?.message || ""))) {
    return smtpError(
      "The SMTP server did not respond in time. Check the SMTP host, port, network/firewall access, and provider security settings.",
      baseDetails
    );
  }

  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "EDNS" || /getaddrinfo|ENOTFOUND|dns/i.test(String(error?.message || ""))) {
    return smtpError(
      `The backend server could not resolve the SMTP host ${provider?.smtpHost || ""}. Check DNS/network access on the machine running the backend, then retry. Hostinger's SMTP host should be smtp.hostinger.com.`,
      baseDetails
    );
  }

  if (/self-signed certificate|certificate chain|unable to verify/i.test(String(error?.message || ""))) {
    return smtpError(
      "The SMTP server certificate could not be verified. If you are on a company network, antivirus, or proxy that inspects TLS, add its CA certificate with NODE_EXTRA_CA_CERTS. For local development only, you can set SMTP_TLS_REJECT_UNAUTHORIZED=false.",
      baseDetails
    );
  }

  return smtpError(`SMTP connection failed: ${error?.message || "Unable to verify SMTP settings"}`, baseDetails);
}

export class SmtpService {
  async listProviders(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    return db.SmtpProvider.findAll({ where, order: [["name", "ASC"]] });
  }

  async createProvider(input: ProviderInput, userId: string) {
    return db.SmtpProvider.create({ ...input, smtpPort: Number(input.smtpPort), createdBy: userId, updatedBy: userId });
  }

  async updateProvider(id: string, input: Partial<ProviderInput>, userId: string) {
    const provider = await db.SmtpProvider.findByPk(id);
    if (!provider) throw Object.assign(new Error("SMTP provider not found"), { statusCode: 404 });
    await provider.update({ ...input, ...(input.smtpPort !== undefined ? { smtpPort: Number(input.smtpPort) } : {}), updatedBy: userId });
    return provider;
  }

  async deleteProvider(id: string) {
    const inUse = await db.BusinessSmtpSetting.count({ where: { providerId: id } });
    if (inUse > 0) throw Object.assign(new Error("Cannot delete an SMTP provider that is used by a business. Deactivate it instead."), { statusCode: 409 });
    return db.SmtpProvider.destroy({ where: { id } });
  }

  async getBusinessSetting(businessId: string) {
    const setting = await db.BusinessSmtpSetting.findOne({
      where: { businessId },
      include: [{ model: db.SmtpProvider }],
    });
    if (!setting) return null;
    const plain = setting.toJSON();
    let maskedEmail: string | null = null;
    let maskedUsername: string | null = null;
    try {
      maskedEmail = maskSecret(decryptCredential(plain.senderEmailEncrypted));
      maskedUsername = maskSecret(decryptCredential(plain.smtpUsernameEncrypted));
    } catch {
      maskedEmail = "configured";
      maskedUsername = "configured";
    }
    return {
      id: plain.id,
      businessId: plain.businessId,
      providerId: plain.providerId,
      senderName: plain.senderName,
      isActive: plain.isActive,
      lastTestedAt: plain.lastTestedAt,
      lastTestStatus: plain.lastTestStatus,
      maskedSenderEmail: maskedEmail,
      maskedSmtpUsername: maskedUsername,
      hasPassword: Boolean(plain.smtpPasswordEncrypted),
      provider: sanitizeProvider(plain.SmtpProvider),
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };
  }

  async upsertBusinessSetting(businessId: string, input: BusinessSmtpInput) {
    const provider = await db.SmtpProvider.findOne({ where: { id: input.providerId, isActive: true } });
    if (!provider) throw Object.assign(new Error("Active SMTP provider not found"), { statusCode: 400 });

    const password = passwordFromInput(input);
    if (!password) throw Object.assign(new Error("SMTP password or application password is required"), { statusCode: 400 });

    const payload = {
      businessId,
      providerId: input.providerId,
      senderName: input.senderName,
      senderEmailEncrypted: encryptCredential(input.senderEmail),
      smtpUsernameEncrypted: encryptCredential(input.smtpUsername),
      smtpPasswordEncrypted: encryptCredential(password),
      isActive: Boolean(input.isActive),
    };

    const existing = await db.BusinessSmtpSetting.findOne({ where: { businessId } });
    if (existing) {
      await existing.update(payload);
      return this.getBusinessSetting(businessId);
    }
    await db.BusinessSmtpSetting.create(payload);
    return this.getBusinessSetting(businessId);
  }

  async resolveBusinessTransport(businessId: string) {
    const setting = await db.BusinessSmtpSetting.findOne({
      where: { businessId, isActive: true },
      include: [{ model: db.SmtpProvider, where: { isActive: true } }],
    });
    if (!setting) return null;
    const plain = setting.toJSON();
    const provider = plain.SmtpProvider;
    const user = decryptCredential(plain.smtpUsernameEncrypted);
    const pass = decryptCredential(plain.smtpPasswordEncrypted);
    const senderEmail = decryptCredential(plain.senderEmailEncrypted);
    const transporter = nodemailer.createTransport(buildTransportOptions(provider, { user, pass }));
    return {
      transporter,
      from: `"${plain.senderName}" <${senderEmail}>`,
      provider,
      senderEmail,
      senderName: plain.senderName,
    };
  }

  async testBusinessSetting(businessId: string, input?: Partial<BusinessSmtpInput>) {
    let transporter: nodemailer.Transporter;
    let providerForError: any = null;
    let senderEmail = "";
    let senderName = "Blih";
    if (input?.providerId && input?.senderEmail && input?.smtpUsername && (input.smtpPassword || input.appPassword)) {
      const provider = await db.SmtpProvider.findOne({ where: { id: input.providerId, isActive: true } });
      if (!provider) throw Object.assign(new Error("Active SMTP provider not found"), { statusCode: 400 });
      providerForError = typeof provider.toJSON === "function" ? provider.toJSON() : provider;
      senderEmail = input.senderEmail;
      senderName = input.senderName || "Blih";
      transporter = nodemailer.createTransport(buildTransportOptions(provider, { user: input.smtpUsername, pass: input.appPassword || input.smtpPassword || "" }));
    } else {
      const resolved = await this.resolveBusinessTransport(businessId);
      if (!resolved) throw Object.assign(new Error("Active business SMTP settings not found"), { statusCode: 400 });
      transporter = resolved.transporter;
      providerForError = resolved.provider;
      senderEmail = resolved.senderEmail;
      senderName = resolved.senderName || "Blih";
    }

    const recipient = input?.testRecipientEmail ? String(input.testRecipientEmail).trim() : "";
    if (input?.testRecipientEmail) assertEmail(recipient, "email address for the test message recipient");

    try {
      await transporter.verify();
      if (recipient) {
        await transporter.sendMail({
          from: `"${senderName}" <${senderEmail}>`,
          to: recipient,
          subject: "Blih SMTP test email",
          text: "Your SMTP settings are working. This test email was sent from Blih.",
          html: "<p>Your SMTP settings are working.</p><p>This test email was sent from Blih.</p>",
        });
      }
      await db.BusinessSmtpSetting.update(
        { lastTestedAt: new Date(), lastTestStatus: "success" },
        { where: { businessId } }
      );
    } catch (error: any) {
      await db.BusinessSmtpSetting.update(
        { lastTestedAt: new Date(), lastTestStatus: "failed" },
        { where: { businessId } }
      );
      throw describeSmtpVerifyFailure(error, providerForError);
    }
    return { sent: Boolean(recipient) };
  }

  async sendPunctualityTestEmail(businessId: string, input: PunctualityTestEmailInput) {
    const recipient = String(input.testRecipientEmail || "").trim();
    assertEmail(recipient, "email address for the test message recipient");
    const resolved = await this.resolveBusinessTransport(businessId);
    if (!resolved) throw Object.assign(new Error("Active business SMTP settings not found"), { statusCode: 400 });

    try {
      await resolved.transporter.verify();
      await resolved.transporter.sendMail({
        from: resolved.from,
        to: recipient,
        subject: input.subject || "Blih punctuality test email",
        text: input.body || "This is a Blih punctuality test email.",
        html: `<p>${escapeHtml(input.body || "This is a Blih punctuality test email.").replace(/\n/g, "<br>")}</p>`,
      });
      await db.BusinessSmtpSetting.update(
        { lastTestedAt: new Date(), lastTestStatus: "success" },
        { where: { businessId } }
      );
      return { sent: true };
    } catch (error: any) {
      await db.BusinessSmtpSetting.update(
        { lastTestedAt: new Date(), lastTestStatus: "failed" },
        { where: { businessId } }
      );
      throw describeSmtpVerifyFailure(error, resolved.provider);
    }
  }
}

export const smtpService = new SmtpService();
