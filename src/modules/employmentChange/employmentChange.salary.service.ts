import { db } from "../../models";
import {
  calculateEthiopianPayroll,
  calculatePayroll,
} from "../finance/payrollTemplate.service";

function numeric(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

type PayrollContext = {
  salaryInfo: any;
  template: any;
};

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
  ): Promise<PayrollContext> {
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

  private usesEthiopianPayroll(template: any) {
    if (!template || !Object.keys(template).length) return true;
    const metadata = template.metadata || {};
    return Boolean(
      template.isDefault ||
        metadata.systemEthiopianDefault ||
        metadata.taxMode === "ethiopian_proclamation",
    );
  }

  private netForBase(
    baseSalary: unknown,
    salaryInfo: any,
    template: any,
  ) {
    const base = numeric(baseSalary);
    if (base <= 0) return null;

    const calculated = this.usesEthiopianPayroll(template)
      ? calculateEthiopianPayroll(
          base,
          template,
          this.optionsForBase(salaryInfo, base),
        )
      : calculatePayroll(base, template);

    return Math.round(numeric(calculated.netPay) * 100) / 100;
  }

  private enrichWithContext(request: any, context: PayrollContext) {
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

    const finalBase =
      plain.finalSalary ??
      plain.recommendedSalary ??
      plain.requestedSalary;

    return {
      ...plain,
      currentNetSalary: this.netForBase(
        plain.currentSalary,
        context.salaryInfo,
        context.template,
      ),
      requestedNetSalary: this.netForBase(
        plain.requestedSalary,
        context.salaryInfo,
        context.template,
      ),
      finalNetSalary: this.netForBase(
        finalBase,
        context.salaryInfo,
        context.template,
      ),
    };
  }

  async enrich(businessId: string, request: any) {
    if (!request) return request;
    const plain = request?.toJSON?.() || request;
    const hasSalaryChange = ["SALARY", "COMBINED"].includes(
      String(plain.requestKind),
    );

    if (!hasSalaryChange) {
      return this.enrichWithContext(plain, {
        salaryInfo: {},
        template: {},
      });
    }

    const context = await this.payrollContext(
      businessId,
      String(plain.employeeUserId),
    );
    return this.enrichWithContext(plain, context);
  }

  async enrichMany(businessId: string, rows: any[]) {
    const contexts = new Map<string, Promise<PayrollContext>>();

    return Promise.all(
      (rows || []).map(async (request) => {
        const plain = request?.toJSON?.() || request;
        const hasSalaryChange = ["SALARY", "COMBINED"].includes(
          String(plain.requestKind),
        );

        if (!hasSalaryChange) {
          return this.enrichWithContext(plain, {
            salaryInfo: {},
            template: {},
          });
        }

        const employeeUserId = String(plain.employeeUserId);
        if (!contexts.has(employeeUserId)) {
          contexts.set(
            employeeUserId,
            this.payrollContext(businessId, employeeUserId),
          );
        }

        const context = await contexts.get(employeeUserId)!;
        return this.enrichWithContext(plain, context);
      }),
    );
  }
}
