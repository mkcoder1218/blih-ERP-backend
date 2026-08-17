import { db } from "../../models";
import { calculateEthiopianPayroll } from "../finance/payrollTemplate.service";

function numeric(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export class EmploymentChangeSalaryService {
  private financialOptions(salaryInfo: any = {}) {
    return {
      pensionableSalary: salaryInfo.pensionableSalary,
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

  private optionsForBase(salaryInfo: any, baseSalary: number) {
    const originalBase = numeric(
      salaryInfo?.baseSalary ??
        salaryInfo?.monthlySalary ??
        salaryInfo?.salary,
    );
    const originalPensionable =
      salaryInfo?.pensionableSalary !== undefined &&
      salaryInfo?.pensionableSalary !== null
        ? numeric(salaryInfo.pensionableSalary)
        : null;

    const pensionableSalary =
      originalPensionable !== null &&
      originalPensionable !== originalBase
        ? originalPensionable
        : baseSalary;

    return {
      ...this.financialOptions(salaryInfo),
      pensionableSalary,
    };
  }

  private async payrollContext(
    businessId: string,
    employeeUserId: string,
  ) {
    const employee = await db.EmployeeRecord.findOne({
      where: { businessId, userId: employeeUserId },
      attributes: ["userId", "salaryInfo"],
    });

    if (!employee) {
      return { salaryInfo: {}, template: {} };
    }

    const link = await db.EmployeePayrollLink.findOne({
      where: { businessId, employeeUserId },
      attributes: ["templateId"],
    });

    const template = link?.templateId
      ? await db.PayrollTemplate.findOne({
          where: { id: link.templateId, businessId },
        })
      : await db.PayrollTemplate.findOne({
          where: { businessId, isDefault: true },
          order: [["createdAt", "DESC"]],
        });

    return {
      salaryInfo: employee.salaryInfo || {},
      template: template?.toJSON?.() || template || {},
    };
  }

  private netForBase(baseSalary: unknown, salaryInfo: any, template: any) {
    const base = numeric(baseSalary);
    if (base <= 0) return null;

    const calculated = calculateEthiopianPayroll(
      base,
      template,
      this.optionsForBase(salaryInfo, base),
    );

    return Math.round(numeric(calculated.netPay) * 100) / 100;
  }

  async enrich(
    businessId: string,
    request: any,
  ) {
    if (!request) return request;

    const plain = request?.toJSON?.() || request;
    const hasSalaryChange = ["SALARY", "COMBINED"].includes(
      String(plain.requestKind),
    );

    if (!hasSalaryChange) {
      return {
        ...plain,
        currentNetSalary: null,
        requestedNetSalary: null,
        finalNetSalary: null,
      };
    }

    const { salaryInfo, template } = await this.payrollContext(
      businessId,
      String(plain.employeeUserId),
    );

    const finalBase =
      plain.finalSalary ??
      plain.recommendedSalary ??
      plain.requestedSalary;

    return {
      ...plain,
      currentNetSalary: this.netForBase(
        plain.currentSalary,
        salaryInfo,
        template,
      ),
      requestedNetSalary: this.netForBase(
        plain.requestedSalary,
        salaryInfo,
        template,
      ),
      finalNetSalary: this.netForBase(
        finalBase,
        salaryInfo,
        template,
      ),
    };
  }

  async enrichMany(businessId: string, rows: any[]) {
    return Promise.all(
      (rows || []).map((row) => this.enrich(businessId, row)),
    );
  }
}
