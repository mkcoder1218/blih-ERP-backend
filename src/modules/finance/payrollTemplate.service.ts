import { db } from "../../models";
import { Op } from "sequelize";
import { TERMINATED_EMPLOYMENT_STATUS } from "../../constants/employee.constants";
import { SalaryDeductionService } from "./salaryDeduction.service";

const ETHIOPIAN_TAX_POLICY = {
  version: "ethiopian_proclamation_410_2017_allowance_caps",
  transportMonthlyCap: 2200,
  perDiemMonthlyCap: 2200,
  perDiemDailyCap: 225,
  allowanceSalaryPctCap: 25,
  fringeTaxSalaryPctCap: 10,
  employeePensionRate: 7,
  employerPensionRate: 11,
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

export function calculateEthiopianPayroll(baseSalary: number, tpl: any = {}, options: any = {}) {
  const m = moneyValue;
  const pct = percentage;

  const metadata = tpl?.metadata || {};
  const housing   = options.housingAllowance != null ? m(options.housingAllowance) : pct(baseSalary, tpl.housingAllowancePct);
  const transport = options.transportAllowance != null ? m(options.transportAllowance) : pct(baseSalary, tpl.transportAllowancePct);
  const meal      = options.mealAllowance != null ? m(options.mealAllowance) : pct(baseSalary, tpl.mealAllowancePct);
  const perDiem   = options.perDiemAllowance != null ? m(options.perDiemAllowance) : 0;
  const perDiemDays = m(options.perDiemDays);
  const medical   = options.medicalBenefit != null ? m(options.medicalBenefit) : 0;
  const telecom   = options.telecomAllowance != null ? m(options.telecomAllowance) : 0;
  const other     = options.otherAllowance != null ? m(options.otherAllowance) : pct(baseSalary, tpl.otherAllowancePct);
  const grossPay  = baseSalary + housing + transport + meal + perDiem + medical + telecom + other;

  const salaryPctCap = baseSalary * (ETHIOPIAN_TAX_POLICY.allowanceSalaryPctCap / 100);
  const transportCap = Math.min(ETHIOPIAN_TAX_POLICY.transportMonthlyCap, salaryPctCap);
  const perDiemDailyCap = Math.max(ETHIOPIAN_TAX_POLICY.perDiemDailyCap, baseSalary * 0.04) * Math.max(perDiemDays, 0);
  const perDiemCap = Math.min(ETHIOPIAN_TAX_POLICY.perDiemMonthlyCap, salaryPctCap, perDiemDays > 0 ? perDiemDailyCap : ETHIOPIAN_TAX_POLICY.perDiemMonthlyCap);
  const transportTax = splitCappedAllowance(transport, transportCap);
  const perDiemTax = splitCappedAllowance(perDiem, perDiemCap);
  const housingTaxable = housing;
  const mealTaxable = meal;
  const fringeTaxable = telecom + other;
  const taxableIncomeBeforeFringe = baseSalary + housingTaxable + mealTaxable + transportTax.taxable + perDiemTax.taxable;
  const taxableIncome = taxableIncomeBeforeFringe + fringeTaxable;
  const baseTax = incomeTaxBracket(taxableIncomeBeforeFringe);
  const fullTax = incomeTaxBracket(taxableIncome);
  const fringeTaxCap = baseSalary * (ETHIOPIAN_TAX_POLICY.fringeTaxSalaryPctCap / 100);
  const fringeTax = Math.min(Math.max(fullTax.tax - baseTax.tax, 0), fringeTaxCap);
  const tax = baseTax.tax + fringeTax;
  const pensionableSalary = options.pensionableSalary != null ? m(options.pensionableSalary) : baseSalary;
  const employeePensionRate = options.employeePensionRate != null ? m(options.employeePensionRate) : m(metadata.employeePensionRate ?? ETHIOPIAN_TAX_POLICY.employeePensionRate);
  const employerPensionRate = options.employerPensionRate != null ? m(options.employerPensionRate) : m(metadata.employerPensionRate ?? ETHIOPIAN_TAX_POLICY.employerPensionRate);
  const pension = pensionableSalary * (employeePensionRate / 100);
  const employerPensionContribution = pensionableSalary * (employerPensionRate / 100);
  const health  = pct(grossPay, tpl.healthPct);
  const loan    = m(tpl.loanRepaymentFlat);
  const otherD  = m(tpl.otherDeductionFlat);
  const totalDeductions = tax + pension + health + loan + otherD;
  const netPay = Math.max(grossPay - totalDeductions, 0);
  const totalCostToCompany = grossPay + employerPensionContribution;

  return {
    baseSalary,
    housingAllowance: housing,
    transportAllowance: transport,
    perDiemAllowance: perDiem,
    medicalBenefit: medical,
    telecomAllowance: telecom,
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
      pensionableSalary,
      employeePensionRate,
      employerPensionRate,
      employeePensionContribution: pension,
      employerPensionContribution,
      totalCostToCompany,
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
          days: perDiemDays,
          rule: "Exempt up to ETB 225/day or 4% of monthly salary per travel day, subject to ETB 2,200/month and 25% salary caps.",
        },
        medical: {
          amount: medical,
          exempt: medical,
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
        meal: {
          amount: meal,
          exempt: 0,
          taxable: mealTaxable,
          treatment: "fully_taxable",
        },
        telecom: {
          amount: telecom,
          exempt: 0,
          taxable: telecom,
          treatment: "usually_taxable_fringe_benefit",
        },
        fringeBenefits: {
          amount: fringeTaxable,
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
  private deductionService = new SalaryDeductionService();

  private m(v: any) { return Number(v ?? 0); }

  private salaryBase(employee: any) {
    return this.m(employee?.salaryInfo?.baseSalary ?? employee?.salaryInfo?.monthlySalary ?? employee?.salaryInfo?.salary);
  }

  private isUnpaidSalaryMarker(row: any) {
    return this.m(row?.baseSalary) === 1
      && (
        this.m(row?.taxableAmount) === 1
        || this.m(row?.grossPay) === 1
        || this.m(row?.totalCostToCompany) === 1
        || this.m(row?.grossSalary) === 1
        || this.m(row?.basicSalary) === 1
      );
  }

  private financialOptionsFromSalaryInfo(salaryInfo: any = {}) {
    return {
      pensionableSalary: salaryInfo.pensionableSalary ?? salaryInfo.baseSalary,
      transportAllowance: salaryInfo.transportAllowance,
      perDiemAllowance: salaryInfo.perDiemAllowance,
      perDiemDays: salaryInfo.perDiemDays,
      medicalBenefit: salaryInfo.medicalBenefit,
      telecomAllowance: salaryInfo.telecomAllowance,
      housingAllowance: salaryInfo.housingAllowance,
      mealAllowance: salaryInfo.mealAllowance,
      otherAllowance: salaryInfo.otherAllowance,
      employeePensionRate: salaryInfo.employeePensionRate,
      employerPensionRate: salaryInfo.employerPensionRate,
    };
  }

  private isEthiopianTemplate(tpl: any) {
    const metadata = tpl?.metadata || {};
    return Boolean(tpl?.isDefault || metadata.systemEthiopianDefault || metadata.taxMode === "ethiopian_proclamation");
  }

  private splitComputed(computed: any) {
    const { taxMeta, ...payroll } = computed;
    return { taxMeta, payroll };
  }

  private computePayroll(baseSalary: number, tpl: any, salaryInfo: any = {}, forceEthiopian = false) {
    if (forceEthiopian || this.isEthiopianTemplate(tpl)) {
      return calculateEthiopianPayroll(baseSalary, tpl, this.financialOptionsFromSalaryInfo(salaryInfo));
    }
    return calculatePayroll(baseSalary, tpl);
  }

  private salaryInfoForBase(salaryInfo: any = {}, baseSalary: number) {
    const existingBaseSalary = this.m(salaryInfo.baseSalary ?? salaryInfo.monthlySalary ?? salaryInfo.salary);
    const existingPensionableSalary = salaryInfo.pensionableSalary != null ? this.m(salaryInfo.pensionableSalary) : null;
    const pensionableSalary = existingPensionableSalary != null && existingPensionableSalary !== existingBaseSalary
      ? existingPensionableSalary
      : baseSalary;
    return {
      ...salaryInfo,
      baseSalary,
      pensionableSalary,
    };
  }

  private salaryInfoWithoutAllowances(salaryInfo: any = {}) {
    return {
      ...salaryInfo,
      transportAllowance: 0,
      perDiemAllowance: 0,
      perDiemDays: 0,
      medicalBenefit: 0,
      telecomAllowance: 0,
      housingAllowance: 0,
      mealAllowance: 0,
      otherAllowance: 0,
    };
  }

  private resolvePayrollFromNetSalary(targetNetSalary: number, tpl: any, salaryInfo: any = {}, forceEthiopian = false) {
    if (!Number.isFinite(targetNetSalary) || targetNetSalary <= 0) throw new Error("Net salary must be a positive number");

    const baseOnlySalaryInfo = this.salaryInfoWithoutAllowances(salaryInfo);
    let lower = 0;
    let upper = Math.max(targetNetSalary * 2, 1000);
    let upperComputed = this.computePayroll(upper, tpl, this.salaryInfoForBase(baseOnlySalaryInfo, upper), forceEthiopian);

    while (upperComputed.netPay < targetNetSalary && upper < 1_000_000_000) {
      upper *= 2;
      upperComputed = this.computePayroll(upper, tpl, this.salaryInfoForBase(baseOnlySalaryInfo, upper), forceEthiopian);
    }

    for (let i = 0; i < 80; i += 1) {
      const mid = (lower + upper) / 2;
      const computed = this.computePayroll(mid, tpl, this.salaryInfoForBase(baseOnlySalaryInfo, mid), forceEthiopian);
      if (computed.netPay < targetNetSalary) lower = mid;
      else upper = mid;
    }

    const baseSalary = Math.round(upper * 100) / 100;
    return this.computePayroll(baseSalary, tpl, this.salaryInfoForBase(salaryInfo, baseSalary), forceEthiopian);
  }

  private maskBankAccount(value: any) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return raw.length <= 4 ? raw : `${"*".repeat(Math.max(raw.length - 4, 0))}${raw.slice(-4)}`;
  }

  private async updateLinkWithEthiopianPayroll(link: any, employee: any, actorUserId: string | null) {
    const tpl = link.template || await this.getTemplate(employee.businessId, link.templateId);
    const salaryInfo = employee.salaryInfo || {};
    const baseSalary = this.m(link.baseSalaryOverride ?? salaryInfo.baseSalary ?? salaryInfo.monthlySalary ?? salaryInfo.salary);
    const computed = calculateEthiopianPayroll(baseSalary, tpl, this.financialOptionsFromSalaryInfo(salaryInfo));
    const { taxMeta, payroll } = this.splitComputed(computed);
    await link.update({
      ...payroll,
      currency: tpl.currency || salaryInfo.currency || "ETB",
      linkedByUserId: actorUserId ?? link.linkedByUserId,
      linkedAt: link.linkedAt || new Date(),
      metadata: {
        ...(link.metadata || {}),
        tax: taxMeta,
      },
    });
    return link.reload({ include: [{ model: db.PayrollTemplate, as: "template" }] });
  }

  private async getAutomaticEthiopianTemplate(businessId: string, actorUserId?: string | null, templateId?: string) {
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
    if (fallbackTemplate) return fallbackTemplate;

    return db.PayrollTemplate.create({
      businessId,
      name: "Ethiopian Statutory Default",
      description: "Default Ethiopian statutory payroll calculation with PAYE and pension.",
      currency: "ETB",
      isDefault: true,
      status: "active",
      createdByUserId: actorUserId || null,
      metadata: {
        systemEthiopianDefault: true,
        taxMode: "ethiopian_proclamation",
        employeePensionRate: ETHIOPIAN_TAX_POLICY.employeePensionRate,
        employerPensionRate: ETHIOPIAN_TAX_POLICY.employerPensionRate,
      },
    });
  }

  async setupAutomaticEthiopianPayroll(businessId: string, actorUserId: string | null, employeeUserId: string, financialInfo: any) {
    const data = financialInfo || {};
    const employee = await db.EmployeeRecord.findOne({ where: { businessId, userId: employeeUserId } });
    if (!employee) throw new Error("Employee not found");

    const tpl = await this.getAutomaticEthiopianTemplate(businessId, actorUserId);
    const rawBaseSalary = data.baseSalary ?? data.monthlySalary ?? data.salary;
    const targetNetSalary = this.m(data.netSalary ?? data.targetNetSalary ?? data.targetNetPay ?? data.netPay);
    const provisionalSalaryInfo = {
      ...(employee.salaryInfo || {}),
      currency: data.currency || employee.salaryInfo?.currency || "ETB",
      transportAllowance: this.m(data.transportAllowance),
      housingAllowance: this.m(data.housingAllowance),
      mealAllowance: this.m(data.mealAllowance),
      otherAllowance: this.m(data.otherAllowance),
      employeePensionRate: this.m(data.employeePensionRate ?? ETHIOPIAN_TAX_POLICY.employeePensionRate),
      employerPensionRate: this.m(data.employerPensionRate ?? ETHIOPIAN_TAX_POLICY.employerPensionRate),
    };
    const computedFromNet = targetNetSalary > 0 && (rawBaseSalary == null || rawBaseSalary === "")
      ? this.resolvePayrollFromNetSalary(targetNetSalary, tpl, provisionalSalaryInfo, true)
      : null;
    const baseSalary = computedFromNet?.baseSalary ?? this.m(rawBaseSalary);
    if (!Number.isFinite(baseSalary) || baseSalary <= 0) throw new Error("Base salary or net salary is required");

    const salaryInfo = {
      ...(employee.salaryInfo || {}),
      baseSalary,
      pensionableSalary: this.m(data.pensionableSalary ?? baseSalary),
      currency: data.currency || employee.salaryInfo?.currency || "ETB",
      taxMode: "ethiopian_proclamation",
      transportAllowance: this.m(data.transportAllowance),
      housingAllowance: this.m(data.housingAllowance),
      mealAllowance: this.m(data.mealAllowance),
      otherAllowance: this.m(data.otherAllowance),
      employeePensionRate: this.m(data.employeePensionRate ?? ETHIOPIAN_TAX_POLICY.employeePensionRate),
      employerPensionRate: this.m(data.employerPensionRate ?? ETHIOPIAN_TAX_POLICY.employerPensionRate),
      bankAccount: data.bankAccount || employee.salaryInfo?.bankAccount || null,
      tin: data.tin || employee.salaryInfo?.tin || null,
      remarks: data.remarks || employee.salaryInfo?.remarks || null,
      paymentStatus: data.paymentStatus || employee.salaryInfo?.paymentStatus || "Pending",
      salaryInputMode: targetNetSalary > 0 && (rawBaseSalary == null || rawBaseSalary === "") ? "net" : "base",
      targetNetSalary: targetNetSalary > 0 ? targetNetSalary : null,
    };
    await employee.update({ salaryInfo });

    return this.linkEmployee(businessId, actorUserId, {
      employeeUserId,
      templateId: tpl.id,
      baseSalaryOverride: baseSalary,
      calculationMode: "ethiopian",
    });
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
    const links = await db.EmployeePayrollLink.findAll({
      where: { businessId, templateId: id },
      include: [{ model: db.PayrollTemplate, as: "template" }],
    });
    for (const link of links) {
      const employee = await db.EmployeeRecord.findOne({ where: { businessId, userId: link.employeeUserId } });
      const computed = this.computePayroll(this.m(link.baseSalaryOverride || link.baseSalary), tpl, employee?.salaryInfo || {});
      const { taxMeta, payroll } = this.splitComputed(computed);
      await link.update({
        ...payroll,
        currency: tpl.currency,
        metadata: { ...(link.metadata || {}), tax: taxMeta || null },
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
    let links = userIds.length
      ? await db.EmployeePayrollLink.findAll({
          where: {
            businessId,
            employeeUserId: { [Op.in]: userIds },
            ...(templateId ? { templateId } : {}),
          },
          include: [
            { model: db.PayrollTemplate, as: "template", attributes: ["id", "name", "currency", "isDefault", "metadata"] },
            { model: db.User, as: "linkedBy", attributes: ["id", "fullName", "email"] },
          ],
        })
      : [];
    let linkByUserId = new Map(links.map((link: any) => [link.employeeUserId, link]));

    if (!templateId) {
      for (const employee of records) {
        const salaryInfo = employee.salaryInfo || {};
        const baseSalary = this.salaryBase(employee);
        if (!linkByUserId.has(employee.userId) && baseSalary > 0) {
          const tpl = await this.getAutomaticEthiopianTemplate(businessId, null);
          await this.linkEmployee(businessId, null, {
            employeeUserId: employee.userId,
            templateId: tpl.id,
            baseSalaryOverride: baseSalary,
            calculationMode: "ethiopian",
          });
        } else {
          const link: any = linkByUserId.get(employee.userId);
          const taxMode = link?.metadata?.tax?.mode || salaryInfo.taxMode;
          if (link && (taxMode === "ethiopian_proclamation" || this.isEthiopianTemplate(link.template))) {
            await this.updateLinkWithEthiopianPayroll(link, employee, null);
          }
        }
      }

      links = userIds.length
        ? await db.EmployeePayrollLink.findAll({
            where: { businessId, employeeUserId: { [Op.in]: userIds } },
            include: [
              { model: db.PayrollTemplate, as: "template", attributes: ["id", "name", "currency", "isDefault", "metadata"] },
              { model: db.User, as: "linkedBy", attributes: ["id", "fullName", "email"] },
            ],
          })
        : [];
      linkByUserId = new Map(links.map((link: any) => [link.employeeUserId, link]));
    }

    let rows = await Promise.all(records.map(async (employee: any) => {
      const link: any = linkByUserId.get(employee.userId);
      const salaryInfo = employee.salaryInfo || {};
      const baseSalary = link ? this.m(link.baseSalary) : this.m(salaryInfo.baseSalary ?? salaryInfo.monthlySalary ?? salaryInfo.salary);
      const taxableAmount = link ? this.m(link?.metadata?.tax?.taxableIncome) : baseSalary;
      if (baseSalary === 1 && taxableAmount === 1) return null;
      const targetNetSalary = link?.metadata?.targetNetSalary ?? salaryInfo.targetNetSalary ?? null;
      const salaryInputMode = link?.metadata?.salaryInputMode ?? salaryInfo.salaryInputMode ?? null;
      const deductionSnapshot = link ? await this.deductionService.syncForPayrollLink(link, query) : null;
      const deductionSummary = deductionSnapshot ? this.deductionService.formatSummary(deductionSnapshot.deductions) : { total: 0, count: 0, rows: [], groups: {} };
      const computedNetPay = this.m(deductionSnapshot?.netPay ?? link?.netPay);
      return {
        id: employee.id,
        userId: employee.userId,
        payrollLinkId: link?.id || null,
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
        tin: salaryInfo.tin || employee.metadata?.tin || employee.metadata?.taxIdentificationNumber || "",
        payPeriod: query.payPeriod || salaryInfo.payPeriod || new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        paymentDate: salaryInfo.paymentDate || null,
        currency: link?.currency || salaryInfo.currency || salaryInfo.salaryCurrency || "ETB",
        baseSalary,
        baseSalaryOverride: link?.baseSalaryOverride ?? null,
        targetNetSalary,
        salaryInputMode,
        housingAllowance: this.m(link?.housingAllowance),
        transportAllowance: this.m(link?.transportAllowance),
        perDiemAllowance: this.m(link?.metadata?.tax?.allowanceBreakdown?.perDiem?.amount ?? salaryInfo.perDiemAllowance),
        perDiemDays: this.m(link?.metadata?.tax?.allowanceBreakdown?.perDiem?.days ?? salaryInfo.perDiemDays),
        medicalBenefit: this.m(link?.metadata?.tax?.allowanceBreakdown?.medical?.amount ?? salaryInfo.medicalBenefit),
        telecomAllowance: this.m(link?.metadata?.tax?.allowanceBreakdown?.telecom?.amount ?? salaryInfo.telecomAllowance),
        mealAllowance: this.m(link?.mealAllowance),
        otherAllowance: this.m(link?.otherAllowance),
        grossPay: this.m(link?.grossPay),
        taxDeduction: this.m(link?.taxDeduction),
        pensionDeduction: this.m(link?.pensionDeduction),
        healthDeduction: this.m(link?.healthDeduction),
        loanDeduction: this.m(link?.loanDeduction),
        otherDeduction: this.m(link?.otherDeduction),
        totalDeductions: this.m(deductionSnapshot?.deductionTotal ?? link?.totalDeductions),
        netPay: computedNetPay,
        computedNetPay,
        deductionTotal: this.m(deductionSummary.total),
        deductionCount: this.m(deductionSummary.count),
        deductionItems: deductionSummary.rows,
        deductionGroups: deductionSummary.groups,
        taxMeta: link?.metadata?.tax || null,
        taxableAmount,
        employeePensionContribution: this.m(link?.pensionDeduction),
        employerPensionContribution: this.m(link?.metadata?.tax?.employerPensionContribution),
        totalCostToCompany: this.m(link?.metadata?.tax?.totalCostToCompany || (link ? this.m(link.grossPay) + this.m(link?.metadata?.tax?.employerPensionContribution) : 0)),
        bankAccount: salaryInfo.bankAccount || employee.metadata?.bankAccountNumber || employee.metadata?.bankDetails?.[0]?.accountNumber || "",
        bankAccountMasked: this.maskBankAccount(salaryInfo.bankAccount || employee.metadata?.bankAccountNumber || employee.metadata?.bankDetails?.[0]?.accountNumber),
        paymentStatus: salaryInfo.paymentStatus || "Pending",
        remarks: salaryInfo.remarks || "",
        overtimePay: this.m(salaryInfo.overtimePay),
        bonusIncentive: this.m(salaryInfo.bonusIncentive),
        arrearsAdjustments: this.m(salaryInfo.arrearsAdjustments),
        workingDaysInPeriod: salaryInfo.workingDaysInPeriod ?? "",
        daysPaid: salaryInfo.daysPaid ?? "",
        generatedBy: link?.linkedBy?.fullName || "",
        approvedBy: salaryInfo.approvedBy || "",
        lastUpdated: link?.updatedAt || employee.updatedAt || null,
        linkedAt: link?.linkedAt || null,
      };
    })).then((items) => items.filter(Boolean));

    if (payrollStatus === "linked" || payrollStatus === "pending") {
      rows = rows.filter((row: any) => row.payrollStatus === payrollStatus);
    }
    if (templateId) {
      rows = rows.filter((row: any) => row.templateId === templateId);
    }
    rows = rows.filter((row: any) => !this.isUnpaidSalaryMarker(row));

    const count = rows.length;
    const pagedRows = rows.slice(offset, offset + limit);
    const totals = rows.reduce(
      (acc: any, row: any) => {
        acc.baseSalary += row.baseSalary;
        acc.grossPay += row.grossPay;
        acc.netPay += row.netPay;
        acc.totalDeductions += row.totalDeductions;
        acc.employerPensionContribution += row.employerPensionContribution;
        acc.totalCostToCompany += row.totalCostToCompany;
        if (row.payrollStatus === "linked") acc.linked += 1;
        return acc;
      },
      { baseSalary: 0, grossPay: 0, netPay: 0, totalDeductions: 0, employerPensionContribution: 0, totalCostToCompany: 0, linked: 0 }
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
  async linkEmployee(businessId: string, actorUserId: string | null, data: {
    employeeUserId: string;
    templateId: string;
    baseSalaryOverride?: number;
    netSalaryOverride?: number;
    pensionableSalary?: number;
    transportAllowance?: number;
    perDiemAllowance?: number;
    perDiemDays?: number;
    medicalBenefit?: number;
    telecomAllowance?: number;
    housingAllowance?: number;
    mealAllowance?: number;
    otherAllowance?: number;
    employeePensionRate?: number;
    employerPensionRate?: number;
    calculationMode?: "ethiopian" | "template";
  }) {
    const employee = await db.EmployeeRecord.findOne({
      where: { businessId, userId: data.employeeUserId },
    });
    if (!employee) throw new Error("Employee not found");

    const tpl = await this.getTemplate(businessId, data.templateId);
    const forceEthiopian = data.calculationMode === "ethiopian";
    const baseSalaryFromInput = data.baseSalaryOverride != null
      ? data.baseSalaryOverride
      : this.m(employee.salaryInfo?.baseSalary ?? employee.salaryInfo?.monthlySalary ?? employee.salaryInfo?.salary);
    const targetNetSalary = this.m(data.netSalaryOverride);
    const salaryInfoForCalculation = {
      ...(employee.salaryInfo || {}),
      ...(data.pensionableSalary != null ? { pensionableSalary: this.m(data.pensionableSalary) } : {}),
      ...(data.transportAllowance != null ? { transportAllowance: this.m(data.transportAllowance) } : {}),
      ...(data.perDiemAllowance != null ? { perDiemAllowance: this.m(data.perDiemAllowance) } : {}),
      ...(data.perDiemDays != null ? { perDiemDays: this.m(data.perDiemDays) } : {}),
      ...(data.medicalBenefit != null ? { medicalBenefit: this.m(data.medicalBenefit) } : {}),
      ...(data.telecomAllowance != null ? { telecomAllowance: this.m(data.telecomAllowance) } : {}),
      ...(data.housingAllowance != null ? { housingAllowance: this.m(data.housingAllowance) } : {}),
      ...(data.mealAllowance != null ? { mealAllowance: this.m(data.mealAllowance) } : {}),
      ...(data.otherAllowance != null ? { otherAllowance: this.m(data.otherAllowance) } : {}),
      ...(data.employeePensionRate != null ? { employeePensionRate: this.m(data.employeePensionRate) } : {}),
      ...(data.employerPensionRate != null ? { employerPensionRate: this.m(data.employerPensionRate) } : {}),
    };
    const computedFromNet = targetNetSalary > 0 && data.baseSalaryOverride == null
      ? this.resolvePayrollFromNetSalary(targetNetSalary, tpl, salaryInfoForCalculation, forceEthiopian)
      : null;
    const baseSalary = computedFromNet?.baseSalary ?? baseSalaryFromInput;

    const computed = computedFromNet ?? this.computePayroll(baseSalary, tpl, this.salaryInfoForBase(salaryInfoForCalculation, baseSalary), forceEthiopian);
    const { taxMeta, payroll } = this.splitComputed(computed);
    const salaryInputMode = targetNetSalary > 0 && data.baseSalaryOverride == null ? "net" : "base";
    const nextSalaryInfo = {
      ...salaryInfoForCalculation,
      baseSalary,
      taxMode: forceEthiopian || this.isEthiopianTemplate(tpl) ? "ethiopian_proclamation" : salaryInfoForCalculation.taxMode,
      salaryInputMode,
      targetNetSalary: targetNetSalary > 0 ? targetNetSalary : null,
    };

    await employee.update({ salaryInfo: nextSalaryInfo });

    // Upsert — employee may already have a link (reassignment)
    const existing = await db.EmployeePayrollLink.findOne({
      where: { businessId, employeeUserId: data.employeeUserId },
    });

    if (existing) {
      await existing.update({
        templateId: data.templateId,
        baseSalaryOverride: baseSalary,
        ...payroll,
        currency: tpl.currency,
        linkedByUserId: actorUserId,
        linkedAt: new Date(),
        metadata: {
          ...(existing.metadata || {}),
          tax: taxMeta || null,
          salaryInputMode,
          targetNetSalary: targetNetSalary > 0 ? targetNetSalary : null,
        },
      });
      return existing.reload({ include: [{ model: db.PayrollTemplate, as: "template" }] });
    }

    return db.EmployeePayrollLink.create({
      businessId,
      employeeUserId: data.employeeUserId,
      templateId: data.templateId,
      baseSalaryOverride: baseSalary,
      ...payroll,
      currency: tpl.currency,
      linkedByUserId: actorUserId,
      linkedAt: new Date(),
      metadata: {
        tax: taxMeta || null,
        salaryInputMode,
        targetNetSalary: targetNetSalary > 0 ? targetNetSalary : null,
      },
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

  async updateEmployeeBaseSalaryWithEthiopianTax(businessId: string, actorUserId: string, employeeUserId: string, salaryInput: any) {
    const employee = await db.EmployeeRecord.findOne({ where: { businessId, userId: employeeUserId } });
    if (!employee) throw new Error("Employee not found");

    const data = typeof salaryInput === "number" ? { baseSalary: salaryInput } : (salaryInput || {});
    const rawBaseSalary = data.baseSalary ?? data.monthlySalary ?? data.salary;
    const targetNetSalary = this.m(data.netSalary ?? data.targetNetSalary ?? data.targetNetPay ?? data.netPay);
    let baseSalary = this.m(rawBaseSalary);

    if ((rawBaseSalary == null || rawBaseSalary === "") && targetNetSalary > 0) {
      const existingLink = await db.EmployeePayrollLink.findOne({
        where: { businessId, employeeUserId },
        include: [{ model: db.PayrollTemplate, as: "template" }],
      });
      const tpl = existingLink?.template || await this.getAutomaticEthiopianTemplate(businessId, actorUserId);
      const computed = this.resolvePayrollFromNetSalary(targetNetSalary, tpl, employee.salaryInfo || {}, true);
      baseSalary = computed.baseSalary;
    }

    if (!Number.isFinite(baseSalary) || baseSalary <= 0) throw new Error("Base salary or net salary must be a positive number");

    await employee.update({
      salaryInfo: {
        ...(employee.salaryInfo || {}),
        baseSalary,
        taxMode: "ethiopian_proclamation",
        salaryInputMode: targetNetSalary > 0 && (rawBaseSalary == null || rawBaseSalary === "") ? "net" : "base",
        targetNetSalary: targetNetSalary > 0 ? targetNetSalary : null,
      },
    });

    const link = await db.EmployeePayrollLink.findOne({
      where: { businessId, employeeUserId },
      include: [{ model: db.PayrollTemplate, as: "template" }],
    });

    if (!link) {
      const tpl = await this.getAutomaticEthiopianTemplate(businessId, actorUserId);
      const created = await this.linkEmployee(businessId, actorUserId, {
        employeeUserId,
        templateId: tpl.id,
        baseSalaryOverride: baseSalary,
        calculationMode: "ethiopian",
      });
      return { employeeUserId, linked: true, baseSalary, created: true, link: created };
    }

    const updated = await this.updateLinkWithEthiopianPayroll(link, employee, actorUserId);

    return {
      employeeUserId,
      linked: true,
      baseSalary,
      currency: updated.currency,
      tax: updated.metadata?.tax,
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
      ? await this.getAutomaticEthiopianTemplate(businessId, actorUserId, query.templateId ? String(query.templateId) : undefined)
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
