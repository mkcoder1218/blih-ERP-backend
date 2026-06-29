import { db } from "../../models";
import { Op } from "sequelize";
import { TERMINATED_EMPLOYMENT_STATUS } from "../../constants/employee.constants";

const ETHIOPIAN_TAX_POLICY = {
  version: "ethiopian_proclamation_410_2017_allowance_caps",
  transportMonthlyCap: 2200,
  perDiemMonthlyCap: 2200,
  perDiemDailyCap: 225,
  allowanceSalaryPctCap: 25,
  fringeTaxSalaryPctCap: 10,
};

function moneyValue(v: any) {
  return Number(v ?? 0);
}

function percentage(base: number, rate: any) {
  return rate != null ? base * (moneyValue(rate) / 100) : 0;
}

function incomeTaxBracket(taxableIncome: number) {
  let rate = 0;
  let deduction = 0;
  if (taxableIncome >= 2001 && taxableIncome <= 4000) {
    rate = 0.15;
    deduction = 300;
  } else if (taxableIncome >= 4001 && taxableIncome <= 7000) {
    rate = 0.20;
    deduction = 500;
  } else if (taxableIncome >= 7001 && taxableIncome <= 10000) {
    rate = 0.25;
    deduction = 850;
  } else if (taxableIncome >= 10001 && taxableIncome <= 14000) {
    rate = 0.30;
    deduction = 1350;
  } else if (taxableIncome > 14000) {
    rate = 0.35;
    deduction = 2050;
  }

  return {
    rate,
    deduction,
    tax: Math.max(taxableIncome * rate - deduction, 0),
  };
}

function splitCappedAllowance(amount: number, cap: number) {
  const exempt = Math.min(Math.max(amount, 0), Math.max(cap, 0));
  return {
    amount,
    exempt,
    taxable: Math.max(amount - exempt, 0),
  };
}

// ─── Calculation helper ───────────────────────────────────────────────────────
export function calculatePayroll(baseSalary: number, tpl: any) {
  const m = moneyValue;
  const pct = percentage;

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

export function calculateEthiopianPayroll(baseSalary: number, tpl: any) {
  const m = moneyValue;
  const pct = percentage;

  const housing   = pct(baseSalary, tpl.housingAllowancePct);
  const transport = pct(baseSalary, tpl.transportAllowancePct);
  const meal      = pct(baseSalary, tpl.mealAllowancePct);
  const other     = pct(baseSalary, tpl.otherAllowancePct);
  const grossPay  = baseSalary + housing + transport + meal + other;

  const salaryPctCap = baseSalary * (ETHIOPIAN_TAX_POLICY.allowanceSalaryPctCap / 100);
  const transportCap = Math.min(ETHIOPIAN_TAX_POLICY.transportMonthlyCap, salaryPctCap);
  const perDiemCap = Math.min(ETHIOPIAN_TAX_POLICY.perDiemMonthlyCap, salaryPctCap);
  const transportTax = splitCappedAllowance(transport, transportCap);
  const perDiemTax = splitCappedAllowance(meal, perDiemCap);
  const housingTaxable = housing;
  const fringeTaxable = other;
  const taxableIncomeBeforeFringe = baseSalary + housingTaxable + transportTax.taxable + perDiemTax.taxable;
  const taxableIncome = taxableIncomeBeforeFringe + fringeTaxable;
  const baseTax = incomeTaxBracket(taxableIncomeBeforeFringe);
  const fullTax = incomeTaxBracket(taxableIncome);
  const fringeTaxCap = baseSalary * (ETHIOPIAN_TAX_POLICY.fringeTaxSalaryPctCap / 100);
  const fringeTax = Math.min(Math.max(fullTax.tax - baseTax.tax, 0), fringeTaxCap);
  const tax = baseTax.tax + fringeTax;
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
    taxMeta: {
      mode: "ethiopian_proclamation",
      policyVersion: ETHIOPIAN_TAX_POLICY.version,
      taxableIncome,
      taxableIncomeBeforeFringe,
      rate: fullTax.rate,
      deduction: fullTax.deduction,
      incomeTaxBeforeFringe: baseTax.tax,
      fringeTax,
      fringeTaxCap,
      allowanceBreakdown: {
        baseSalary: { amount: baseSalary, exempt: 0, taxable: baseSalary, treatment: "fully_taxable" },
        transport: {
          ...transportTax,
          cap: transportCap,
          treatment: "partially_exempt",
          rule: "Exempt up to the lower of ETB 2,200 per month or 25% of base salary.",
        },
        perDiem: {
          ...perDiemTax,
          cap: perDiemCap,
          dailyCap: ETHIOPIAN_TAX_POLICY.perDiemDailyCap,
          treatment: "partially_exempt",
          rule: "Monthly exemption uses the lower of ETB 2,200 per month or 25% of base salary. Daily travel-day cap support needs a per-diem days field.",
        },
        medical: {
          amount: 0,
          exempt: 0,
          taxable: 0,
          treatment: "generally_exempt_when_documented",
          rule: "Medical treatment or insurance is generally exempt when supported by documentation.",
        },
        housing: {
          amount: housing,
          exempt: 0,
          taxable: housingTaxable,
          treatment: "fully_taxable",
        },
        fringeBenefits: {
          amount: other,
          exempt: 0,
          taxable: fringeTaxable,
          treatment: "taxable_with_tax_cap",
          taxCap: fringeTaxCap,
          rule: "Tax payable on combined fringe benefits is capped at 10% of base salary.",
        },
      },
    },
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────
export class PayrollTemplateService {
  private m(v: any) { return Number(v ?? 0); }

  private async getDefaultTemplateForSync(businessId: string, templateId?: string) {
    if (templateId) {
      return this.getTemplate(businessId, templateId);
    }

    const defaultTemplate = await db.PayrollTemplate.findOne({
      where: { businessId, status: "active", isDefault: true },
      order: [["createdAt", "DESC"]],
    });
    if (defaultTemplate) return defaultTemplate;

    const fallbackTemplate = await db.PayrollTemplate.findOne({
      where: { businessId, status: "active" },
      order: [["createdAt", "DESC"]],
    });
    if (!fallbackTemplate) {
      throw new Error("Create an active payroll template before syncing Ethiopian tax");
    }

    return fallbackTemplate;
  }

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
      await link.update({
        ...computed,
        currency: tpl.currency,
        metadata: { ...(link.metadata || {}), tax: null },
      });
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

  async listEmployeeSalaries(businessId: string, query: any = {}) {
    const page = Math.max(Number(query.page || 1), 1);
    const maxLimit = String(query.exportAll || "").toLowerCase() === "true" ? 5000 : 100;
    const limit = Math.min(Math.max(Number(query.limit || 10), 1), maxLimit);
    const offset = (page - 1) * limit;
    const q = String(query.q || "").trim();
    const departmentId = String(query.departmentId || "");
    const employmentStatus = String(query.employmentStatus || "");
    const payrollStatus = String(query.payrollStatus || "");
    const templateId = String(query.templateId || "");

    const where: any = {
      businessId,
      employmentStatus: { [Op.ne]: TERMINATED_EMPLOYMENT_STATUS },
    };
    if (departmentId) where.departmentId = departmentId;
    if (employmentStatus) where.employmentStatus = employmentStatus;

    const userWhere: any = { status: "active" };
    if (q) {
      userWhere[Op.or] = [
        { fullName: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const records = await db.EmployeeRecord.findAll({
      where,
      include: [
        { model: db.User, as: "user", attributes: ["id", "fullName", "email"], where: userWhere, required: true },
        { model: db.Department, as: "department", attributes: ["id", "name"] },
        { model: db.Position, as: "position", attributes: ["id", "title"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    const userIds = records.map((employee: any) => employee.userId);
    const links = userIds.length
      ? await db.EmployeePayrollLink.findAll({
          where: {
            businessId,
            employeeUserId: { [Op.in]: userIds },
            ...(templateId ? { templateId } : {}),
          },
          include: [{ model: db.PayrollTemplate, as: "template", attributes: ["id", "name", "currency"] }],
        })
      : [];
    const linkByUserId = new Map(links.map((link: any) => [link.employeeUserId, link]));

    let rows = records.map((employee: any) => {
      const link: any = linkByUserId.get(employee.userId);
      const salaryInfo = employee.salaryInfo || {};
      const baseSalary = link ? this.m(link.baseSalary) : this.m(salaryInfo.baseSalary ?? salaryInfo.monthlySalary ?? salaryInfo.salary);
      return {
        id: employee.id,
        userId: employee.userId,
        employeeCode: employee.employeeCode,
        name: employee.user?.fullName || "Unknown",
        email: employee.user?.email || "",
        department: employee.department ? { id: employee.department.id, name: employee.department.name } : null,
        position: employee.position ? { id: employee.position.id, title: employee.position.title } : null,
        employmentType: employee.employmentType,
        employmentStatus: employee.employmentStatus,
        hireDate: employee.hireDate,
        salaryInfo,
        payrollStatus: link ? "linked" : "pending",
        templateId: link?.templateId || null,
        templateName: link?.template?.name || null,
        currency: link?.currency || salaryInfo.currency || salaryInfo.salaryCurrency || "ETB",
        baseSalary,
        baseSalaryOverride: link?.baseSalaryOverride ?? null,
        housingAllowance: this.m(link?.housingAllowance),
        transportAllowance: this.m(link?.transportAllowance),
        mealAllowance: this.m(link?.mealAllowance),
        otherAllowance: this.m(link?.otherAllowance),
        grossPay: this.m(link?.grossPay),
        taxDeduction: this.m(link?.taxDeduction),
        pensionDeduction: this.m(link?.pensionDeduction),
        healthDeduction: this.m(link?.healthDeduction),
        loanDeduction: this.m(link?.loanDeduction),
        otherDeduction: this.m(link?.otherDeduction),
        totalDeductions: this.m(link?.totalDeductions),
        netPay: this.m(link?.netPay),
        taxMeta: link?.metadata?.tax || null,
        linkedAt: link?.linkedAt || null,
      };
    });

    if (payrollStatus === "linked" || payrollStatus === "pending") {
      rows = rows.filter((row: any) => row.payrollStatus === payrollStatus);
    }
    if (templateId) {
      rows = rows.filter((row: any) => row.templateId === templateId);
    }

    const count = rows.length;
    const pagedRows = rows.slice(offset, offset + limit);
    const totals = rows.reduce(
      (acc: any, row: any) => {
        acc.baseSalary += row.baseSalary;
        acc.grossPay += row.grossPay;
        acc.netPay += row.netPay;
        if (row.payrollStatus === "linked") acc.linked += 1;
        return acc;
      },
      { baseSalary: 0, grossPay: 0, netPay: 0, linked: 0 }
    );

    return {
      rows: pagedRows,
      count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      totals,
    };
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
        metadata: { ...(existing.metadata || {}), tax: null },
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
  async bulkLinkEmployees(businessId: string, actorUserId: string, data: {
    employeeUserIds: string[];
    templateId: string;
  }) {
    const employeeUserIds = Array.from(new Set((data.employeeUserIds || []).filter(Boolean)));
    if (!data.templateId) throw new Error("Payroll template is required");
    if (!employeeUserIds.length) throw new Error("Select at least one employee");

    await this.getTemplate(businessId, data.templateId);
    const results: any[] = [];
    for (const employeeUserId of employeeUserIds) {
      const link = await this.linkEmployee(businessId, actorUserId, {
        employeeUserId,
        templateId: data.templateId,
      });
      results.push(link);
    }

    return {
      linkedCount: results.length,
      employeeUserIds,
    };
  }

  async updateEmployeeBaseSalaryWithEthiopianTax(businessId: string, actorUserId: string, employeeUserId: string, baseSalary: number) {
    if (!Number.isFinite(baseSalary) || baseSalary < 0) throw new Error("Base salary must be a positive number");

    const employee = await db.EmployeeRecord.findOne({ where: { businessId, userId: employeeUserId } });
    if (!employee) throw new Error("Employee not found");

    await employee.update({
      salaryInfo: {
        ...(employee.salaryInfo || {}),
        baseSalary,
        taxMode: "ethiopian_proclamation",
      },
    });

    const link = await db.EmployeePayrollLink.findOne({
      where: { businessId, employeeUserId },
      include: [{ model: db.PayrollTemplate, as: "template" }],
    });

    if (!link) {
      return { employeeUserId, linked: false, baseSalary };
    }

    const tpl = link.template || await this.getTemplate(businessId, link.templateId);
    const computed = calculateEthiopianPayroll(baseSalary, tpl);
    const { taxMeta, ...payroll } = computed;
    await link.update({
      baseSalaryOverride: baseSalary,
      ...payroll,
      currency: tpl.currency,
      linkedByUserId: actorUserId,
      linkedAt: new Date(),
      metadata: {
        ...(link.metadata || {}),
        tax: taxMeta,
      },
    });

    return {
      employeeUserId,
      linked: true,
      ...payroll,
      currency: tpl.currency,
      tax: taxMeta,
    };
  }

  async syncEthiopianTax(businessId: string, actorUserId: string, query: any = {}) {
    const data = await this.listEmployeeSalaries(businessId, {
      ...query,
      page: 1,
      limit: 5000,
      exportAll: "true",
    });
    const pendingRows = data.rows.filter((row: any) => row.payrollStatus !== "linked");
    const templateForPending = pendingRows.length
      ? await this.getDefaultTemplateForSync(businessId, query.templateId ? String(query.templateId) : undefined)
      : null;
    const results: any[] = [];
    let autoLinkedCount = 0;

    for (const row of data.rows) {
      if (row.payrollStatus !== "linked") {
        await this.linkEmployee(businessId, actorUserId, {
          employeeUserId: row.userId,
          templateId: templateForPending.id,
        });
        autoLinkedCount += 1;
      }

      const result = await this.updateEmployeeBaseSalaryWithEthiopianTax(
        businessId,
        actorUserId,
        row.userId,
        this.m(row.baseSalary)
      );
      results.push(result);
    }

    return {
      syncedCount: results.length,
      autoLinkedCount,
      skippedNeedsSetup: 0,
      totalMatched: data.rows.length,
      templateUsedForAutoLink: templateForPending
        ? { id: templateForPending.id, name: templateForPending.name }
        : null,
    };
  }

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
      taxMeta: link.metadata?.tax || null,
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
