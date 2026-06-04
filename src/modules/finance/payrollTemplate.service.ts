import { db } from "../../models";
import { Op } from "sequelize";
import { TERMINATED_EMPLOYMENT_STATUS } from "../../constants/employee.constants";

// ─── Calculation helper ───────────────────────────────────────────────────────
export function calculatePayroll(baseSalary: number, tpl: any) {
  const m = (v: any) => Number(v ?? 0);
  const pct = (base: number, rate: any) => (rate != null ? base * (m(rate) / 100) : 0);

  const housing   = pct(baseSalary, tpl.housingAllowancePct);
  const transport = pct(baseSalary, tpl.transportAllowancePct);
  const meal      = pct(baseSalary, tpl.mealAllowancePct);
  const other     = pct(baseSalary, tpl.otherAllowancePct);
  const grossPay  = baseSalary + housing + transport + meal + other;

  const tax     = pct(grossPay, tpl.taxPct);
  const pension = pct(grossPay, tpl.pensionPct);
  const health  = pct(grossPay, tpl.healthPct);
  const loan    = m(tpl.loanRepaymentFlat);
  const otherD  = m(tpl.otherDeductionFlat);
  const totalDeductions = tax + pension + health + loan + otherD;
  const netPay = Math.max(grossPay - totalDeductions, 0);

  return {
    baseSalary,
    housingAllowance: housing,
    transportAllowance: transport,
    mealAllowance: meal,
    otherAllowance: other,
    grossPay,
    taxDeduction: tax,
    pensionDeduction: pension,
    healthDeduction: health,
    loanDeduction: loan,
    otherDeduction: otherD,
    totalDeductions,
    netPay,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────
export class PayrollTemplateService {
  private m(v: any) { return Number(v ?? 0); }

  // ── Templates CRUD ─────────────────────────────────────────────────────────
  async listTemplates(businessId: string) {
    return db.PayrollTemplate.findAll({
      where: { businessId, status: "active" },
      order: [["createdAt", "DESC"]],
    });
  }

  async getTemplate(businessId: string, id: string) {
    const tpl = await db.PayrollTemplate.findOne({ where: { id, businessId } });
    if (!tpl) throw new Error("Payroll template not found");
    return tpl;
  }

  async createTemplate(businessId: string, actorUserId: string, data: any) {
    // If this template is marked default, unset all others
    if (data.isDefault) {
      await db.PayrollTemplate.update({ isDefault: false }, { where: { businessId } });
    }
    return db.PayrollTemplate.create({ ...data, businessId, createdByUserId: actorUserId });
  }

  async updateTemplate(businessId: string, id: string, data: any) {
    const tpl = await this.getTemplate(businessId, id);
    if (data.isDefault) {
      await db.PayrollTemplate.update({ isDefault: false }, { where: { businessId } });
    }
    await tpl.update(data);

    // Recalculate all links that use this template
    const links = await db.EmployeePayrollLink.findAll({ where: { businessId, templateId: id } });
    for (const link of links) {
      const computed = calculatePayroll(this.m(link.baseSalaryOverride || link.baseSalary), tpl);
      await link.update({ ...computed, currency: tpl.currency });
    }
    return tpl.reload();
  }

  async deleteTemplate(businessId: string, id: string) {
    const linked = await db.EmployeePayrollLink.count({ where: { businessId, templateId: id } });
    if (linked > 0) throw new Error("Cannot delete a template that has linked employees. Reassign them first.");
    const tpl = await this.getTemplate(businessId, id);
    await tpl.destroy();
  }

  // ── Preview calculation without saving ─────────────────────────────────────
  previewCalculation(baseSalary: number, templateData: any) {
    return calculatePayroll(baseSalary, templateData);
  }

  // ── Pending employees (no payroll link) ────────────────────────────────────
  async getPendingEmployees(businessId: string) {
    const allEmployees = await db.EmployeeRecord.findAll({
      where: { businessId, employmentStatus: { [Op.ne]: TERMINATED_EMPLOYMENT_STATUS } },
      include: [
        { model: db.User, as: "user", attributes: ["id", "fullName", "email"] },
        { model: db.Department, as: "department", attributes: ["id", "name"] },
        { model: db.Position, as: "position", attributes: ["id", "title"] },
      ],
    });

    const linkedUserIds = new Set(
      (await db.EmployeePayrollLink.findAll({
        where: { businessId },
        attributes: ["employeeUserId"],
      })).map((l: any) => l.employeeUserId)
    );

    return allEmployees
      .filter((emp: any) => !linkedUserIds.has(emp.userId))
      .map((emp: any) => ({
        id: emp.id,
        userId: emp.userId,
        name: emp.user?.fullName || "Unknown",
        email: emp.user?.email,
        department: emp.department?.name || "Unassigned",
        role: emp.position?.title || emp.employmentType || "Employee",
        hireDate: emp.hireDate,
        baseSalary: this.m(emp.salaryInfo?.baseSalary ?? emp.salaryInfo?.monthlySalary ?? emp.salaryInfo?.salary),
      }));
  }

  // ── Linked employees (have a payroll link) ──────────────────────────────────
  async getLinkedEmployees(businessId: string) {
    return db.EmployeePayrollLink.findAll({
      where: { businessId },
      include: [
        { model: db.User, as: "employee", attributes: ["id", "fullName", "email"] },
        { model: db.PayrollTemplate, as: "template", attributes: ["id", "name", "currency"] },
      ],
      order: [["linkedAt", "DESC"]],
    });
  }

  // ── Link an employee to a template + calculate ──────────────────────────────
  async linkEmployee(businessId: string, actorUserId: string, data: {
    employeeUserId: string;
    templateId: string;
    baseSalaryOverride?: number;
  }) {
    const employee = await db.EmployeeRecord.findOne({
      where: { businessId, userId: data.employeeUserId },
    });
    if (!employee) throw new Error("Employee not found");

    const tpl = await this.getTemplate(businessId, data.templateId);
    const baseSalary = data.baseSalaryOverride != null
      ? data.baseSalaryOverride
      : this.m(employee.salaryInfo?.baseSalary ?? employee.salaryInfo?.monthlySalary ?? employee.salaryInfo?.salary);

    const computed = calculatePayroll(baseSalary, tpl);

    // Upsert — employee may already have a link (reassignment)
    const existing = await db.EmployeePayrollLink.findOne({
      where: { businessId, employeeUserId: data.employeeUserId },
    });

    if (existing) {
      await existing.update({
        templateId: data.templateId,
        baseSalaryOverride: data.baseSalaryOverride ?? null,
        ...computed,
        currency: tpl.currency,
        linkedByUserId: actorUserId,
        linkedAt: new Date(),
      });
      return existing.reload({ include: [{ model: db.PayrollTemplate, as: "template" }] });
    }

    return db.EmployeePayrollLink.create({
      businessId,
      employeeUserId: data.employeeUserId,
      templateId: data.templateId,
      baseSalaryOverride: data.baseSalaryOverride ?? null,
      ...computed,
      currency: tpl.currency,
      linkedByUserId: actorUserId,
      linkedAt: new Date(),
    });
  }

  // ── Unlink (move back to pending) ───────────────────────────────────────────
  async unlinkEmployee(businessId: string, employeeUserId: string) {
    const link = await db.EmployeePayrollLink.findOne({ where: { businessId, employeeUserId } });
    if (!link) throw new Error("No payroll link found for this employee");
    await link.destroy();
  }

  // ── Full payroll data for the workforce dashboard ───────────────────────────
  async getPayrollDashboardData(businessId: string) {
    const [pending, linked, templates] = await Promise.all([
      this.getPendingEmployees(businessId),
      this.getLinkedEmployees(businessId),
      this.listTemplates(businessId),
    ]);

    const linkedFormatted = linked.map((link: any) => ({
      id: link.id,
      employeeUserId: link.employeeUserId,
      name: link.employee?.fullName || "Unknown",
      email: link.employee?.email,
      templateId: link.templateId,
      templateName: link.template?.name || "Unknown Template",
      baseSalary: this.m(link.baseSalary),
      housingAllowance: this.m(link.housingAllowance),
      transportAllowance: this.m(link.transportAllowance),
      mealAllowance: this.m(link.mealAllowance),
      otherAllowance: this.m(link.otherAllowance),
      grossPay: this.m(link.grossPay),
      taxDeduction: this.m(link.taxDeduction),
      pensionDeduction: this.m(link.pensionDeduction),
      healthDeduction: this.m(link.healthDeduction),
      loanDeduction: this.m(link.loanDeduction),
      otherDeduction: this.m(link.otherDeduction),
      totalDeductions: this.m(link.totalDeductions),
      netPay: this.m(link.netPay),
      currency: link.currency,
      status: link.status,
      linkedAt: link.linkedAt,
    }));

    const totalNetPayroll = linkedFormatted.reduce((s: number, l: any) => s + l.netPay, 0);
    const totalGross = linkedFormatted.reduce((s: number, l: any) => s + l.grossPay, 0);

    return {
      summary: {
        totalEmployees: pending.length + linked.length,
        pendingCount: pending.length,
        linkedCount: linked.length,
        totalNetPayroll,
        totalGross,
      },
      pending,
      linked: linkedFormatted,
      templates: templates.map((t: any) => this.formatTemplate(t)),
    };
  }

  formatTemplate(t: any) {
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      housingAllowancePct: t.housingAllowancePct,
      transportAllowancePct: t.transportAllowancePct,
      mealAllowancePct: t.mealAllowancePct,
      otherAllowancePct: t.otherAllowancePct,
      taxPct: t.taxPct,
      pensionPct: t.pensionPct,
      healthPct: t.healthPct,
      loanRepaymentFlat: t.loanRepaymentFlat,
      otherDeductionFlat: t.otherDeductionFlat,
      currency: t.currency,
      isDefault: t.isDefault,
      status: t.status,
      createdAt: t.createdAt,
    };
  }
}
