import type {
  Request,
  Response,
} from "express";

import {
  Op,
} from "sequelize";

import {
  db,
} from "../../models";

import {
  renderEmploymentContractDocument,
} from "../../utils/employmentContractRenderer";

import {
  hasMeaningfulRichText,
  richTextToPlainText,
  sanitizeRichTextHtml,
} from "../../utils/richTextSanitizer";

import {
  errorResponse,
  successResponse,
} from "../../utils/response";

type MissingField = {
  key: string;
  label: string;
};

type ContractAssignmentInput = {
  templateId: string;

  candidateName?: string;
  candidateEmail?: string;
  candidatePhone?: string | null;

  departmentId?: string | null;
  departmentName?: string | null;

  positionId?: string | null;
  positionName?: string | null;

  reportingManagerId?: string | null;
  managerName?: string | null;

  contractType?: string;
  employmentType?: string | null;
  workLocation?: string | null;

  salary?: string | number | null;
  currency?: string;

  startDate?: string | null;
  endDate?: string | null;

  probationStartDate?: string | null;
  probationEndDate?: string | null;

  noticePeriodDays?: number | null;

  companyName?: string;
  companyAddress?: string;

  subject?: string;
  bodyHtml?: string;
  bodyText?: string;

  metadata?: Record<string, unknown>;
};

function cleanString(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

function nullableString(
  value: unknown,
): string | null {
  const cleaned =
    cleanString(value);

  return cleaned || null;
}

function normalizeDate(
  value: unknown,
): string | null {
  const cleaned =
    cleanString(value);

  if (!cleaned) {
    return null;
  }

  const parsed =
    new Date(cleaned);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return cleaned;
  }

  return parsed
    .toISOString()
    .slice(0, 10);
}

function formatDate(
  value: unknown,
): string {
  if (!value) {
    return "";
  }

  const date =
    new Date(String(value));

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  ).format(date);
}

function formatSalary(
  salary: unknown,
  currency: unknown,
): string {
  if (
    salary === null ||
    salary === undefined ||
    salary === ""
  ) {
    return "";
  }

  const numeric =
    Number(salary);

  const normalizedCurrency =
    cleanString(currency) ||
    "ETB";

  if (
    Number.isNaN(numeric)
  ) {
    return `${String(
      salary,
    )} ${normalizedCurrency}`;
  }

  return `${numeric.toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )} ${normalizedCurrency}`;
}

function getManagerName(
  manager: any,
): string {
  if (!manager) {
    return "";
  }

  if (manager.fullName) {
    return manager.fullName;
  }

  return [
    manager.firstName,
    manager.lastName,
  ]
    .filter(Boolean)
    .join(" ");
}

function readCompanyAddress(
  business: any,
): string {
  const settings =
    business?.settings &&
    typeof business.settings ===
      "object"
      ? business.settings
      : {};

  return cleanString(
    settings.companyAddress,
  );
}

function extractSalaryInfo(
  employee: any,
) {
  const salaryInfo =
    employee?.salaryInfo &&
    typeof employee.salaryInfo ===
      "object"
      ? employee.salaryInfo
      : {};

  const salary =
    salaryInfo.baseSalary ??
    salaryInfo.monthlySalary ??
    salaryInfo.salary ??
    salaryInfo.netSalary ??
    null;

  const currency =
    cleanString(
      salaryInfo.currency,
    ) || "ETB";

  return {
    salary,
    currency,
  };
}

function extractWorkLocation(
  employee: any,
): string {
  const metadata =
    employee?.metadata &&
    typeof employee.metadata ===
      "object"
      ? employee.metadata
      : {};

  return cleanString(
    metadata.workLocation ??
    metadata.officeLocation ??
    metadata.location,
  );
}

function calculateProbationStartDate(
  employee: any,
): string | null {
  return normalizeDate(
    employee.contractStartDate ||
    employee.hireDate,
  );
}

function findMissingFields(
  data: {
    candidateName: string;
    candidateEmail: string;
    departmentName: string;
    positionName: string;
    salary: unknown;
    startDate: string | null;
    workLocation: string;
    companyName: string;
    companyAddress: string;
    templateId: string;
    subject: string;
    bodyHtml: string;
  },
): MissingField[] {
  const missing: MissingField[] =
    [];

  const required: Array<{
    key: keyof typeof data;
    label: string;
  }> = [
    {
      key: "candidateName",
      label: "Employee name",
    },
    {
      key: "candidateEmail",
      label: "Employee email",
    },
    {
      key: "departmentName",
      label: "Department",
    },
    {
      key: "positionName",
      label: "Position",
    },
    {
      key: "salary",
      label: "Salary",
    },
    {
      key: "startDate",
      label: "Employment start date",
    },
    {
      key: "workLocation",
      label: "Work location",
    },
    {
      key: "companyName",
      label: "Company name",
    },
    {
      key: "companyAddress",
      label: "Company address",
    },
    {
      key: "templateId",
      label: "Contract template",
    },
    {
      key: "subject",
      label: "Contract subject",
    },
    {
      key: "bodyHtml",
      label: "Contract content",
    },
  ];

  for (
    const item
    of required
  ) {
    const value =
      data[item.key];

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      missing.push({
        key:
          String(item.key),
        label:
          item.label,
      });
    }
  }

  return missing;
}

function buildRenderData(
  contract: {
    contractNumber: string;
    candidateName: string;
    candidateEmail: string;
    candidatePhone?: string | null;
    contractType: string;
    employmentType?: string | null;
    workLocation?: string | null;
    salary?: string | number | null;
    currency: string;
    startDate?: string | null;
    endDate?: string | null;
    probationStartDate?: string | null;
    probationEndDate?: string | null;
    noticePeriodDays?: number | null;
  },
  snapshot: {
    companyName: string;
    companyAddress: string;
    departmentName: string;
    positionName: string;
    managerName: string;
  },
) {
  return {
    contractNumber:
      contract.contractNumber,

    candidateName:
      contract.candidateName,

    candidateEmail:
      contract.candidateEmail,

    candidatePhone:
      contract.candidatePhone ||
      "",

    employeeName:
      contract.candidateName,

    employeeEmail:
      contract.candidateEmail,

    companyName:
      snapshot.companyName,

    companyAddress:
      snapshot.companyAddress,

    jobTitle:
      snapshot.positionName,

    positionName:
      snapshot.positionName,

    departmentName:
      snapshot.departmentName,

    managerName:
      snapshot.managerName,

    salary:
      contract.salary ?? "",

    currency:
      contract.currency,

    formattedSalary:
      formatSalary(
        contract.salary,
        contract.currency,
      ),

    employmentType:
      contract.employmentType ||
      "",

    contractType:
      contract.contractType,

    workLocation:
      contract.workLocation ||
      "",

    startDate:
      formatDate(
        contract.startDate,
      ),

    endDate:
      formatDate(
        contract.endDate,
      ),

    probationStartDate:
      formatDate(
        contract.probationStartDate,
      ),

    probationEndDate:
      formatDate(
        contract.probationEndDate,
      ),

    noticePeriodDays:
      contract.noticePeriodDays ??
      "",

    createdDate:
      formatDate(
        new Date(),
      ),
  };
}

async function loadEmployee(
  employeeRecordId: string,
  businessId: string,
) {
  return db.EmployeeRecord.findOne({
    where: {
      id:
        employeeRecordId,

      businessId,
    },

    include: [
      {
        model:
          db.User,

        as:
          "user",

        attributes: [
          "id",
          "fullName",
          "email",
          "phone",
          "status",
        ],

        required:
          true,
      },

      {
        model:
          db.Department,

        as:
          "department",

        attributes: [
          "id",
          "name",
        ],

        required:
          false,
      },

      {
        model:
          db.Position,

        as:
          "position",

        attributes: [
          "id",
          "title",
        ],

        required:
          false,
      },

      {
        model:
          db.User,

        as:
          "manager",

        attributes: [
          "id",
          "fullName",
          "email",
        ],

        required:
          false,
      },
    ],
  });
}

async function loadBusiness(
  businessId: string,
) {
  return db.Business.findByPk(
    businessId,
    {
      attributes: [
        "id",
        "name",
        "email",
        "phone",
        "settings",
      ],
    },
  );
}

export class EmploymentContractAssignmentController {
  getEmployeePrefill = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const businessId =
        req.user!.businessId;

      const employee =
        await loadEmployee(
          req.params.employeeRecordId,
          businessId,
        );

      if (!employee) {
        return errorResponse(
          res,
          "Employee record not found",
          404,
        );
      }

      const business =
        await loadBusiness(
          businessId,
        );

      if (!business) {
        return errorResponse(
          res,
          "Business not found",
          404,
        );
      }

      const employeeJson =
        employee.toJSON();

      const businessJson =
        business.toJSON();

      const salaryInfo =
        extractSalaryInfo(
          employeeJson,
        );

      const companyName =
        cleanString(
          businessJson.name,
        );

      const companyAddress =
        readCompanyAddress(
          businessJson,
        );

      const candidateName =
        cleanString(
          employeeJson.user
            ?.fullName,
        );

      const candidateEmail =
        cleanString(
          employeeJson.user
            ?.email,
        );

      const candidatePhone =
        cleanString(
          employeeJson.user
            ?.phone,
        );

      const departmentName =
        cleanString(
          employeeJson.department
            ?.name,
        );

      const positionName =
        cleanString(
          employeeJson.position
            ?.title,
        );

      const managerName =
        getManagerName(
          employeeJson.manager,
        );

      const startDate =
        normalizeDate(
          employeeJson.contractStartDate ||
          employeeJson.hireDate,
        );

      const workLocation =
        extractWorkLocation(
          employeeJson,
        );

      const defaultData = {
        employeeRecordId:
          employeeJson.id,

        userId:
          employeeJson.userId,

        candidateName,

        candidateEmail,

        candidatePhone,

        departmentId:
          employeeJson.departmentId ||
          null,

        departmentName,

        positionId:
          employeeJson.positionId ||
          null,

        positionName,

        reportingManagerId:
          employeeJson.managerUserId ||
          null,

        managerName,

        contractType:
          "PERMANENT",

        employmentType:
          employeeJson.employmentType ||
          null,

        workLocation,

        salary:
          salaryInfo.salary,

        currency:
          salaryInfo.currency,

        startDate,

        endDate:
          normalizeDate(
            employeeJson.contractEndDate,
          ),

        probationStartDate:
          calculateProbationStartDate(
            employeeJson,
          ),

        probationEndDate:
          normalizeDate(
            employeeJson.probationEndDate,
          ),

        noticePeriodDays:
          null,

        companyName,

        companyAddress,
      };

      const missingFields =
        findMissingFields({
          candidateName,
          candidateEmail,
          departmentName,
          positionName,
          salary:
            salaryInfo.salary,
          startDate,
          workLocation,
          companyName,
          companyAddress,
          templateId:
            "",
          subject:
            "",
          bodyHtml:
            "",
        }).filter(
          (field) =>
            ![
              "templateId",
              "subject",
              "bodyHtml",
            ].includes(
              field.key,
            ),
        );

      return successResponse(
        res,
        {
          employee:
            defaultData,

          missingFields,
        },
        "Employee contract information loaded",
      );
    } catch (error: any) {
      return errorResponse(
        res,
        error.message,
        500,
      );
    }
  };

  assignContract = async (
    req: Request,
    res: Response,
  ) => {
    const transaction =
      await db.sequelize.transaction();

    try {
      const businessId =
        req.user!.businessId;

      const employee =
        await loadEmployee(
          req.params.employeeRecordId,
          businessId,
        );

      if (!employee) {
        await transaction.rollback();

        return errorResponse(
          res,
          "Employee record not found",
          404,
        );
      }

      const employeeJson =
        employee.toJSON();

      const business =
        await loadBusiness(
          businessId,
        );

      if (!business) {
        await transaction.rollback();

        return errorResponse(
          res,
          "Business not found",
          404,
        );
      }

      const input =
        req.body as ContractAssignmentInput;

      const template =
        await db.EmploymentContractTemplate.findOne(
          {
            where: {
              id:
                input.templateId,

              businessId,

              isActive:
                true,
            },

            transaction,
          },
        );

      if (!template) {
        await transaction.rollback();

        return errorResponse(
          res,
          "Contract template not found or inactive",
          404,
        );
      }

      const existingContract =
        await db.EmploymentContract.findOne(
          {
            where: {
              businessId,

              employeeRecordId:
                employeeJson.id,

              status: {
                [Op.notIn]: [
                  "TERMINATED",
                  "CANCELLED",
                  "SUPERSEDED",
                  "EXPIRED",
                ],
              },
            },

            transaction,
          },
        );

      if (existingContract) {
        await transaction.rollback();

        return errorResponse(
          res,
          "This employee already has an active or pending employment contract",
          409,
          {
            contractId:
              existingContract.id,

            status:
              existingContract.status,
          },
        );
      }

      const salaryInfo =
        extractSalaryInfo(
          employeeJson,
        );

      const businessJson =
        business.toJSON();

      const candidateName =
        cleanString(
          input.candidateName ||
          employeeJson.user?.fullName,
        );

      const candidateEmail =
        cleanString(
          input.candidateEmail ||
          employeeJson.user?.email,
        );

      const candidatePhone =
        nullableString(
          input.candidatePhone ??
          employeeJson.user?.phone,
        );

      const departmentId =
        nullableString(
          input.departmentId ??
          employeeJson.departmentId,
        );

      const departmentName =
        cleanString(
          input.departmentName ||
          employeeJson.department?.name,
        );

      const positionId =
        nullableString(
          input.positionId ??
          employeeJson.positionId,
        );

      const positionName =
        cleanString(
          input.positionName ||
          employeeJson.position?.title,
        );

      const reportingManagerId =
        nullableString(
          input.reportingManagerId ??
          employeeJson.managerUserId,
        );

      const managerName =
        cleanString(
          input.managerName ||
          getManagerName(
            employeeJson.manager,
          ),
        );

      const contractType =
        cleanString(
          input.contractType ||
          template.contractType ||
          "PERMANENT",
        ).toUpperCase();

      const employmentType =
        nullableString(
          input.employmentType ??
          employeeJson.employmentType,
        );

      const workLocation =
        cleanString(
          input.workLocation ||
          extractWorkLocation(
            employeeJson,
          ),
        );

      const salary =
        input.salary ??
        salaryInfo.salary;

      const currency =
        cleanString(
          input.currency ||
          salaryInfo.currency ||
          "ETB",
        ).toUpperCase();

      const startDate =
        normalizeDate(
          input.startDate ||
          employeeJson.contractStartDate ||
          employeeJson.hireDate,
        );

      const endDate =
        normalizeDate(
          input.endDate ??
          employeeJson.contractEndDate,
        );

      const probationStartDate =
        normalizeDate(
          input.probationStartDate ||
          employeeJson.contractStartDate ||
          employeeJson.hireDate,
        );

      const probationEndDate =
        normalizeDate(
          input.probationEndDate ??
          employeeJson.probationEndDate,
        );

      const noticePeriodDays =
        input.noticePeriodDays ??
        null;

      const companyName =
        cleanString(
          input.companyName ||
          businessJson.name,
        );

      const companyAddress =
        cleanString(
          input.companyAddress ||
          readCompanyAddress(
            businessJson,
          ),
        );

      const subject =
        cleanString(
          input.subject ||
          template.subject,
        );

      const bodyHtml =
        sanitizeRichTextHtml(
          input.bodyHtml ||
          template.bodyHtml,
        );

      if (
        !hasMeaningfulRichText(
          bodyHtml,
        )
      ) {
        await transaction.rollback();

        return errorResponse(
          res,
          "Contract content cannot be empty",
          400,
        );
      }

      const missingFields =
        findMissingFields({
          candidateName,
          candidateEmail,
          departmentName,
          positionName,
          salary,
          startDate,
          workLocation,
          companyName,
          companyAddress,
          templateId:
            input.templateId,
          subject,
          bodyHtml,
        });

      if (
        missingFields.length >
        0
      ) {
        await transaction.rollback();

        return errorResponse(
          res,
          "Required contract information is missing",
          400,
          {
            missingFields,
          },
        );
      }

      const contractNumber =
        `CTR-${new Date()
          .toISOString()
          .slice(0, 7)
          .replace("-", "")}-${String(
            employeeJson.employeeCode ||
            employeeJson.id,
          )
          .replace(
            /[^a-zA-Z0-9]/g,
            "",
          )
          .slice(-8)
          .toUpperCase()}-${Date.now()
          .toString()
          .slice(-5)}`;

      const renderData =
        buildRenderData(
          {
            contractNumber,
            candidateName,
            candidateEmail,
            candidatePhone,
            contractType,
            employmentType,
            workLocation,
            salary,
            currency,
            startDate,
            endDate,
            probationStartDate,
            probationEndDate,
            noticePeriodDays,
          },
          {
            companyName,
            companyAddress,
            departmentName,
            positionName,
            managerName,
          },
        );

      const rendered =
        renderEmploymentContractDocument(
          {
            subject,
            bodyHtml,

            bodyText:
              input.bodyText ||
              template.bodyText ||
              richTextToPlainText(
                bodyHtml,
              ),

            data:
              renderData,
          },
        );

      if (
        rendered.missingVariables
          .length > 0
      ) {
        await transaction.rollback();

        return errorResponse(
          res,
          "The contract template still contains values that could not be filled",
          400,
          {
            missingVariables:
              rendered.missingVariables,
          },
        );
      }

      const now =
        new Date();

      const contract =
        await db.EmploymentContract.create(
          {
            businessId,

            contractNumber,

            templateId:
              template.id,

            offerId:
              null,

            candidateOnboardingId:
              null,

            employeeRecordId:
              employeeJson.id,

            candidateName,

            candidateEmail,

            candidatePhone,

            departmentId,

            positionId,

            reportingManagerId,

            contractType,

            employmentType,

            workLocation,

            salary:
              salary === "" ||
              salary === null ||
              salary === undefined
                ? null
                : String(salary),

            currency,

            startDate,

            endDate,

            probationStartDate,

            probationEndDate,

            noticePeriodDays,

            subject,

            bodyHtml,

            bodyText:
              input.bodyText ||
              template.bodyText ||
              richTextToPlainText(
                bodyHtml,
              ),

            renderedSubject:
              rendered.renderedSubject,

            renderedHtml:
              rendered.renderedHtml,

            renderedText:
              rendered.renderedText,

            status:
              "SENT",

            sentAt:
              now,

            metadata: {
              ...(
                input.metadata ||
                {}
              ),

              assignment: {
                assignedAt:
                  now.toISOString(),

                assignedByUserId:
                  req.user!.id,

                assignedToUserId:
                  employeeJson.userId,

                employeeRecordId:
                  employeeJson.id,
              },

              snapshot: {
                companyName,
                companyAddress,

                departmentId,
                departmentName,

                positionId,
                positionName,

                reportingManagerId,
                managerName,

                candidateName,
                candidateEmail,
                candidatePhone,

                employmentType,
                workLocation,

                salary:
                  salary === null ||
                  salary === undefined
                    ? null
                    : String(salary),

                currency,

                startDate,
                endDate,

                probationStartDate,
                probationEndDate,

                noticePeriodDays,
              },

              renderData,
            },

            createdById:
              req.user!.id,

            updatedById:
              req.user!.id,
          },
          {
            transaction,
          },
        );

      await transaction.commit();

      return successResponse(
        res,
        contract,
        "Employment contract assigned successfully",
        201,
      );
    } catch (error: any) {
      await transaction.rollback();

      return errorResponse(
        res,
        error.message,
        500,
      );
    }
  };
}
