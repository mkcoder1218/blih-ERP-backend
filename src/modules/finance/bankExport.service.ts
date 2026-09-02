import { DataTypes } from "sequelize";
import { sequelize } from "../../database/sequelize";
import { db } from "../../models";
import defineBankExportTemplate from "../../models/BankExportTemplate";
import { generateDocumentPdf } from "../../utils/documentPdfGenerator";
import { PayrollTemplateService } from "./payrollTemplate.service";

const BankExportTemplate =
  sequelize.models.BankExportTemplate ||
  defineBankExportTemplate(sequelize, DataTypes);

const DEFAULT_BANK_TEMPLATE_BODY = `
  <p><strong>Salary Transfer Instruction</strong></p>
  <p>Please process the salary payments for <strong>{{pay_period}}</strong> for {{employee_count}} employees.</p>
  <p>Total payroll: <strong>{{total_net_payroll}}</strong></p>
  <p>{{employee_table}}</p>
`;

function httpError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function replaceToken(html: string, token: string, value: string) {
  return html.split(`{{${token}}}`).join(value);
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "ETB",
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${currency || "ETB"} ${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
}

function periodLabel(rows: any[], dateFrom?: string, dateTo?: string) {
  const payPeriods = Array.from(
    new Set(rows.map((row) => String(row.payPeriod || "").trim()).filter(Boolean)),
  );
  if (payPeriods.length === 1) return payPeriods[0];
  if (dateFrom && dateTo) return `${dateFrom} to ${dateTo}`;
  if (dateFrom) return `From ${dateFrom}`;
  if (dateTo) return `Up to ${dateTo}`;
  return payPeriods.join(", ") || "Current payroll period";
}

function employeeTable(rows: any[]) {
  const body = rows
    .map(
      (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(row.name || "")}</td>
          <td>${escapeHtml(row.bankAccount || "")}</td>
          <td style="text-align:right; white-space:nowrap;">${escapeHtml(formatMoney(Number(row.netPay || 0), row.currency || "ETB"))}</td>
        </tr>`,
    )
    .join("");

  return `
    <table>
      <thead>
        <tr>
          <th style="width:44px;">#</th>
          <th>Employee</th>
          <th>Bank Account</th>
          <th style="text-align:right;">Net Salary</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function totalPayrollLabel(rows: any[]) {
  const totals = rows.reduce((acc: Map<string, number>, row: any) => {
    const currency = String(row.currency || "ETB").toUpperCase();
    acc.set(currency, (acc.get(currency) || 0) + Number(row.netPay || 0));
    return acc;
  }, new Map<string, number>());

  return Array.from(totals.entries())
    .map(([currency, total]) => formatMoney(total, currency))
    .join(" / ");
}

export type BankSalaryExportQuery = {
  selectedUserIds?: string[] | string;
  q?: string;
  search?: string;
  departmentId?: string;
  employmentStatus?: string;
  payrollStatus?: string;
  templateId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export class BankExportService {
  private payrollService = new PayrollTemplateService();

  async listTemplates(businessId: string) {
    return BankExportTemplate.findAll({
      where: { businessId },
      order: [
        ["isDefault", "DESC"],
        ["updatedAt", "DESC"],
      ],
    });
  }

  async getTemplate(businessId: string, templateId: string) {
    const template = await BankExportTemplate.findOne({
      where: { id: templateId, businessId },
    });
    if (!template) throw httpError("Bank export template not found", 404);
    return template;
  }

  async createTemplate(businessId: string, actorUserId: string, data: any) {
    const name = String(data?.name || "").trim();
    const bodyHtml = String(data?.bodyHtml || DEFAULT_BANK_TEMPLATE_BODY).trim();
    if (!name) throw httpError("Template name is required");
    if (!bodyHtml) throw httpError("Template body is required");

    if (data?.isDefault) {
      await BankExportTemplate.update(
        { isDefault: false },
        { where: { businessId } },
      );
    }

    return BankExportTemplate.create({
      businessId,
      name,
      headerHtml: String(data?.headerHtml || "").trim() || null,
      bodyHtml,
      footerHtml: String(data?.footerHtml || "").trim() || null,
      isDefault: Boolean(data?.isDefault),
      isActive: data?.isActive !== false,
      createdByUserId: actorUserId,
      updatedByUserId: actorUserId,
    });
  }

  async updateTemplate(
    businessId: string,
    templateId: string,
    actorUserId: string,
    data: any,
  ) {
    const template = await this.getTemplate(businessId, templateId);
    if (data?.isDefault) {
      await BankExportTemplate.update(
        { isDefault: false },
        { where: { businessId } },
      );
    }

    const updates: Record<string, unknown> = { updatedByUserId: actorUserId };
    if (data?.name !== undefined) {
      const name = String(data.name || "").trim();
      if (!name) throw httpError("Template name is required");
      updates.name = name;
    }
    if (data?.headerHtml !== undefined) {
      updates.headerHtml = String(data.headerHtml || "").trim() || null;
    }
    if (data?.bodyHtml !== undefined) {
      const bodyHtml = String(data.bodyHtml || "").trim();
      if (!bodyHtml) throw httpError("Template body is required");
      updates.bodyHtml = bodyHtml;
    }
    if (data?.footerHtml !== undefined) {
      updates.footerHtml = String(data.footerHtml || "").trim() || null;
    }
    if (data?.isDefault !== undefined) updates.isDefault = Boolean(data.isDefault);
    if (data?.isActive !== undefined) updates.isActive = Boolean(data.isActive);

    await template.update(updates);
    return template.reload();
  }

  async deleteTemplate(businessId: string, templateId: string) {
    const template = await this.getTemplate(businessId, templateId);
    await template.destroy();
  }

  async generateBankDocument(
    businessId: string,
    templateId: string,
    query: BankSalaryExportQuery,
  ) {
    const template: any = await this.getTemplate(businessId, templateId);
    if (!template.isActive) throw httpError("This bank export template is inactive");

    const salaryQuery: any = {
      ...query,
      q: query.q || query.search || "",
      page: 1,
      limit: 5000,
      exportAll: "true",
    };
    delete salaryQuery.search;
    delete salaryQuery.templateId;

    const salaryData = await this.payrollService.listEmployeeSalaries(
      businessId,
      salaryQuery,
    );
    const rows = salaryData.rows || [];
    if (!rows.length) throw httpError("No employee salaries matched this export");

    const missingBankAccounts = rows.filter((row: any) => !String(row.bankAccount || "").trim());
    if (missingBankAccounts.length) {
      const names = missingBankAccounts.slice(0, 8).map((row: any) => row.name).join(", ");
      const suffix = missingBankAccounts.length > 8 ? ` and ${missingBankAccounts.length - 8} more` : "";
      throw httpError(`Bank account is missing for: ${names}${suffix}`);
    }

    const business: any = await db.Business.findByPk(businessId);
    const tableHtml = employeeTable(rows);
    const payPeriod = periodLabel(rows, query.dateFrom, query.dateTo);
    const totalNetPayroll = totalPayrollLabel(rows);
    const currencies = Array.from(new Set(rows.map((row: any) => String(row.currency || "ETB").toUpperCase()))).join(", ");

    const replacements: Record<string, string> = {
      company_name: escapeHtml(business?.businessName || business?.legalName || "Company"),
      period_start: escapeHtml(query.dateFrom || ""),
      period_end: escapeHtml(query.dateTo || ""),
      pay_period: escapeHtml(payPeriod),
      employee_count: String(rows.length),
      total_net_payroll: escapeHtml(totalNetPayroll),
      currency: escapeHtml(currencies),
      generated_date: escapeHtml(new Date().toISOString().slice(0, 10)),
      employee_table: tableHtml,
    };

    const render = (source: string | null | undefined) => {
      let html = String(source || "");
      for (const [token, value] of Object.entries(replacements)) {
        html = replaceToken(html, token, value);
      }
      return html;
    };

    let bodyHtml = render(template.bodyHtml);
    if (!String(template.bodyHtml || "").includes("{{employee_table}}")) {
      bodyHtml += tableHtml;
    }

    const pdf = await generateDocumentPdf({
      title: `Salary Transfer Instruction - ${payPeriod}`,
      headerHtml: render(template.headerHtml),
      bodyHtml,
      footerHtml: render(template.footerHtml),
    });

    const safePeriod = payPeriod.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "payroll";
    return {
      pdf,
      filename: `bank-salary-instruction-${safePeriod}.pdf`,
      employeeCount: rows.length,
    };
  }
}

export const BANK_EXPORT_DEFAULT_BODY = DEFAULT_BANK_TEMPLATE_BODY;
