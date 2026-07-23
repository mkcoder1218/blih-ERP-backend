import {
  randomUUID,
} from "crypto";

import type {
  Request,
  Response,
} from "express";

import {
  Op,
  type Transaction,
} from "sequelize";

import { db } from "../../models";

import {
  EMPLOYMENT_CONTRACT_STATUSES,
  type EmploymentContractStatus,
} from "../../models/EmploymentContract";

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
  paginationResponse,
  successResponse,
} from "../../utils/response";

const EDITABLE_STATUSES:
  EmploymentContractStatus[] = [
    "DRAFT",
    "READY",
  ];

function nullableUuid(
  value: unknown,
): string | null {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  return String(value);
}

function nullableValue<T>(
  value: T | "" | undefined,
): T | null {
  if (
    value === "" ||
    value === undefined
  ) {
    return null;
  }

  return value;
}

function createContractNumber(): string {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1,
    ).padStart(2, "0");

  const suffix =
    randomUUID()
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase();

  return `CTR-${year}${month}-${suffix}`;
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

  if (
    Number.isNaN(numeric)
  ) {
    return `${String(
      salary,
    )} ${String(
      currency || "ETB",
    )}`;
  }

  return `${numeric.toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )} ${String(
    currency || "ETB",
  )}`;
}

async function getBusinessName(
  businessId: string,
): Promise<string> {
  const business =
    await db.Business.findByPk(
      businessId,
      {
        attributes: [
          "id",
          "name",
        ],
      },
    );

  return business?.name || "";
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

function buildRenderData(
  contract: any,
  companyName: string,
) {
  const positionName =
    contract.position?.title || "";

  const departmentName =
    contract.department?.name || "";

  const managerName =
    getManagerName(
      contract.reportingManager,
    );

  return {
    contractNumber:
      contract.contractNumber || "",

    candidateName:
      contract.candidateName || "",

    candidateEmail:
      contract.candidateEmail || "",

    candidatePhone:
      contract.candidatePhone || "",

    employeeName:
      contract.candidateName || "",

    employeeEmail:
      contract.candidateEmail || "",

    companyName,

    companyAddress: "",

    jobTitle:
      positionName,

    positionName,

    departmentName,

    managerName,

    salary:
      contract.salary || "",

    currency:
      contract.currency || "ETB",

    formattedSalary:
      formatSalary(
        contract.salary,
        contract.currency,
      ),

    employmentType:
      contract.employmentType || "",

    contractType:
      contract.contractType || "",

    workLocation:
      contract.workLocation || "",

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
      contract.noticePeriodDays ?? "",

    createdDate:
      formatDate(
        contract.createdAt ||
        new Date(),
      ),
  };
}

function contractIncludes() {
  return [
    {
      model:
        db.EmploymentContractTemplate,

      as: "template",

      attributes: [
        "id",
        "name",
        "contractType",
      ],

      required: false,
    },

    {
      model:
        db.OfferLetter,

      as: "offer",

      attributes: [
        "id",
        "candidateName",
        "candidateEmail",
        "status",
      ],

      required: false,
    },

    {
      model:
        db.Department,

      as: "department",

      attributes: [
        "id",
        "name",
      ],

      required: false,
    },

    {
      model:
        db.Position,

      as: "position",

      attributes: [
        "id",
        "title",
      ],

      required: false,
    },

    {
      model:
        db.User,

      as: "reportingManager",

      attributes: [
        "id",
        "fullName",
        "email",
      ],

      required: false,
    },
  ];
}

async function findContract(
  id: string,
  businessId: string,
) {
  return db.EmploymentContract.findOne(
    {
      where: {
        id,
        businessId,
      },

      include:
        contractIncludes(),
    },
  );
}

async function linkOnboarding(
  contractId: string,
  candidateOnboardingId:
    | string
    | null
    | undefined,
  transaction?: Transaction,
) {
  if (!candidateOnboardingId) {
    return;
  }

  await db.CandidateOnboarding.update(
    {
      contractId,
    },
    {
      where: {
        id:
          candidateOnboardingId,
      },

      transaction,
    },
  );
}

export class EmploymentContractController {
  getStatuses = async (
    _req: Request,
    res: Response,
  ) => {
    return successResponse(
      res,
      EMPLOYMENT_CONTRACT_STATUSES,
    );
  };

  getTemplates = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const where: any = {
        businessId:
          req.user!.businessId,
      };

      const includeInactive =
        String(
          req.query.includeInactive ||
          "",
        ).toLowerCase() === "true";

      if (!includeInactive) {
        where.isActive = true;
      }

      if (
        req.query.contractType
      ) {
        where.contractType =
          String(
            req.query.contractType,
          ).toUpperCase();
      }

      const templates =
        await db.EmploymentContractTemplate.findAll(
          {
            where,

            order: [
              [
                "isDefault",
                "DESC",
              ],
              [
                "name",
                "ASC",
              ],
            ],
          },
        );

      return successResponse(
        res,
        templates,
      );
    } catch (error: any) {
      return errorResponse(
        res,
        error.message,
        500,
      );
    }
  };

  createTemplate = async (
    req: Request,
    res: Response,
  ) => {
    const transaction =
      await db.sequelize.transaction();

    try {
      const businessId =
        req.user!.businessId;

      const bodyHtml =
        sanitizeRichTextHtml(
          req.body.bodyHtml,
        );

      if (
        !hasMeaningfulRichText(
          bodyHtml,
        )
      ) {
        await transaction.rollback();

        return errorResponse(
          res,
          "Contract template content cannot be empty",
          400,
        );
      }

      if (
        req.body.isDefault
      ) {
        await db.EmploymentContractTemplate.update(
          {
            isDefault: false,
          },
          {
            where: {
              businessId,

              contractType:
                req.body.contractType,
            },

            transaction,
          },
        );
      }

      const template =
        await db.EmploymentContractTemplate.create(
          {
            businessId,

            name:
              req.body.name,

            description:
              req.body.description ||
              null,

            contractType:
              req.body.contractType,

            subject:
              req.body.subject,

            bodyHtml,

            bodyText:
              req.body.bodyText?.trim() ||
              richTextToPlainText(
                bodyHtml,
              ),

            variables:
              req.body.variables || [],

            isDefault:
              Boolean(
                req.body.isDefault,
              ),

            isActive:
              req.body.isActive !== false,

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
        template,
        "Contract template created",
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

  updateTemplate = async (
    req: Request,
    res: Response,
  ) => {
    const transaction =
      await db.sequelize.transaction();

    try {
      const businessId =
        req.user!.businessId;

      const template =
        await db.EmploymentContractTemplate.findOne(
          {
            where: {
              id: req.params.id,
              businessId,
            },

            transaction,
          },
        );

      if (!template) {
        await transaction.rollback();

        return errorResponse(
          res,
          "Contract template not found",
          404,
        );
      }

      const updates: any = {
        ...req.body,

        updatedById:
          req.user!.id,
      };

      if (
        req.body.bodyHtml !==
        undefined
      ) {
        const bodyHtml =
          sanitizeRichTextHtml(
            req.body.bodyHtml,
          );

        if (
          !hasMeaningfulRichText(
            bodyHtml,
          )
        ) {
          await transaction.rollback();

          return errorResponse(
            res,
            "Contract template content cannot be empty",
            400,
          );
        }

        updates.bodyHtml =
          bodyHtml;

        if (
          req.body.bodyText ===
          undefined
        ) {
          updates.bodyText =
            richTextToPlainText(
              bodyHtml,
            );
        }
      }

      const nextContractType =
        String(
          req.body.contractType ||
          template.contractType,
        ).toUpperCase();

      if (
        req.body.isDefault === true
      ) {
        await db.EmploymentContractTemplate.update(
          {
            isDefault: false,
          },
          {
            where: {
              businessId,

              contractType:
                nextContractType,

              id: {
                [Op.ne]:
                  template.id,
              },
            },

            transaction,
          },
        );
      }

      await template.update(
        updates,
        {
          transaction,
        },
      );

      await transaction.commit();

      return successResponse(
        res,
        template,
        "Contract template updated",
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

  deleteTemplate = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const template =
        await db.EmploymentContractTemplate.findOne(
          {
            where: {
              id: req.params.id,

              businessId:
                req.user!.businessId,
            },
          },
        );

      if (!template) {
        return errorResponse(
          res,
          "Contract template not found",
          404,
        );
      }

      await template.update({
        isActive: false,
        isDefault: false,
        updatedById:
          req.user!.id,
      });

      return successResponse(
        res,
        null,
        "Contract template deactivated",
      );
    } catch (error: any) {
      return errorResponse(
        res,
        error.message,
        500,
      );
    }
  };

  getContracts = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const limit =
        Number(
          req.query.limit || 20,
        );

      const offset =
        Number(
          req.query.offset || 0,
        );

      const where: any = {
        businessId:
          req.user!.businessId,
      };

      if (
        req.query.status
      ) {
        where.status =
          String(
            req.query.status,
          ).toUpperCase();
      }

      if (
        req.query.offerId
      ) {
        where.offerId =
          req.query.offerId;
      }

      if (
        req.query.employeeRecordId
      ) {
        where.employeeRecordId =
          req.query.employeeRecordId;
      }

      const search =
        String(
          req.query.search || "",
        ).trim();

      if (search) {
        where[Op.or] = [
          {
            contractNumber: {
              [Op.iLike]:
                `%${search}%`,
            },
          },

          {
            candidateName: {
              [Op.iLike]:
                `%${search}%`,
            },
          },

          {
            candidateEmail: {
              [Op.iLike]:
                `%${search}%`,
            },
          },
        ];
      }

      const result =
        await db.EmploymentContract.findAndCountAll(
          {
            where,

            distinct: true,

            limit,
            offset,

            order: [
              [
                "createdAt",
                "DESC",
              ],
            ],

            include:
              contractIncludes(),
          },
        );

      return paginationResponse(
        res,
        result.rows,
        result.count,
        Math.floor(
          offset / limit,
        ) + 1,
        limit,
      );
    } catch (error: any) {
      return errorResponse(
        res,
        error.message,
        500,
      );
    }
  };

  getContract = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const contract =
        await findContract(
          req.params.id,
          req.user!.businessId,
        );

      if (!contract) {
        return errorResponse(
          res,
          "Employment contract not found",
          404,
        );
      }

      return successResponse(
        res,
        contract,
      );
    } catch (error: any) {
      return errorResponse(
        res,
        error.message,
        500,
      );
    }
  };

  createContract = async (
    req: Request,
    res: Response,
  ) => {
    const transaction =
      await db.sequelize.transaction();

    try {
      const bodyHtml =
        sanitizeRichTextHtml(
          req.body.bodyHtml,
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

      const contract =
        await db.EmploymentContract.create(
          {
            businessId:
              req.user!.businessId,

            contractNumber:
              createContractNumber(),

            templateId:
              nullableUuid(
                req.body.templateId,
              ),

            offerId:
              nullableUuid(
                req.body.offerId,
              ),

            candidateOnboardingId:
              nullableUuid(
                req.body.candidateOnboardingId,
              ),

            employeeRecordId:
              nullableUuid(
                req.body.employeeRecordId,
              ),

            candidateName:
              req.body.candidateName,

            candidateEmail:
              req.body.candidateEmail,

            candidatePhone:
              req.body.candidatePhone ||
              null,

            departmentId:
              nullableUuid(
                req.body.departmentId,
              ),

            positionId:
              nullableUuid(
                req.body.positionId,
              ),

            reportingManagerId:
              nullableUuid(
                req.body.reportingManagerId,
              ),

            contractType:
              req.body.contractType,

            employmentType:
              req.body.employmentType ||
              null,

            workLocation:
              req.body.workLocation ||
              null,

            salary:
              nullableValue(
                req.body.salary,
              ),

            currency:
              req.body.currency ||
              "ETB",

            startDate:
              nullableValue(
                req.body.startDate,
              ),

            endDate:
              nullableValue(
                req.body.endDate,
              ),

            probationStartDate:
              nullableValue(
                req.body.probationStartDate,
              ),

            probationEndDate:
              nullableValue(
                req.body.probationEndDate,
              ),

            noticePeriodDays:
              nullableValue(
                req.body.noticePeriodDays,
              ),

            subject:
              req.body.subject,

            bodyHtml,

            bodyText:
              req.body.bodyText?.trim() ||
              richTextToPlainText(
                bodyHtml,
              ),

            status: "DRAFT",

            metadata:
              req.body.metadata || {},

            createdById:
              req.user!.id,

            updatedById:
              req.user!.id,
          },
          {
            transaction,
          },
        );

      await linkOnboarding(
        contract.id,
        contract.candidateOnboardingId,
        transaction,
      );

      await transaction.commit();

      const created =
        await findContract(
          contract.id,
          req.user!.businessId,
        );

      return successResponse(
        res,
        created,
        "Employment contract created",
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

  createFromOffer = async (
    req: Request,
    res: Response,
  ) => {
    const transaction =
      await db.sequelize.transaction();

    try {
      const businessId =
        req.user!.businessId;

      const offer =
        await db.OfferLetter.findOne(
          {
            where: {
              id:
                req.params.offerId,

              businessId,
            },

            transaction,
          },
        );

      if (!offer) {
        await transaction.rollback();

        return errorResponse(
          res,
          "Offer letter not found",
          404,
        );
      }

      if (
        offer.status !==
        "ACCEPTED"
      ) {
        await transaction.rollback();

        return errorResponse(
          res,
          "Only accepted offers can be converted into contracts",
          400,
        );
      }

      const existingContract =
        await db.EmploymentContract.findOne(
          {
            where: {
              businessId,

              offerId:
                offer.id,

              status: {
                [Op.notIn]: [
                  "CANCELLED",
                  "TERMINATED",
                  "SUPERSEDED",
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
          "A contract already exists for this offer",
          409,
          {
            contractId:
              existingContract.id,
          },
        );
      }

      const template =
        await db.EmploymentContractTemplate.findOne(
          {
            where: {
              id:
                req.body.templateId,

              businessId,

              isActive: true,
            },

            transaction,
          },
        );

      if (!template) {
        await transaction.rollback();

        return errorResponse(
          res,
          "Contract template not found",
          404,
        );
      }

      const bodyHtml =
        sanitizeRichTextHtml(
          req.body.bodyHtml ||
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

      const contract =
        await db.EmploymentContract.create(
          {
            businessId,

            contractNumber:
              createContractNumber(),

            templateId:
              template.id,

            offerId:
              offer.id,

            candidateOnboardingId:
              nullableUuid(
                req.body.candidateOnboardingId,
              ),

            employeeRecordId:
              null,

            candidateName:
              offer.candidateName,

            candidateEmail:
              offer.candidateEmail,

            candidatePhone:
              offer.candidatePhone ||
              null,

            departmentId:
              offer.departmentId ||
              null,

            positionId:
              offer.positionId ||
              null,

            reportingManagerId:
              offer.reportingManagerId ||
              null,

            contractType:
              req.body.contractType ||
              template.contractType ||
              "PERMANENT",

            employmentType:
              offer.employmentType ||
              null,

            workLocation:
              offer.workLocation ||
              null,

            salary:
              offer.salary ||
              null,

            currency:
              "ETB",

            startDate:
              offer.startDate ||
              null,

            endDate:
              nullableValue(
                req.body.endDate,
              ),

            probationStartDate:
              nullableValue(
                req.body.probationStartDate,
              ),

            probationEndDate:
              nullableValue(
                req.body.probationEndDate,
              ),

            noticePeriodDays:
              nullableValue(
                req.body.noticePeriodDays,
              ),

            subject:
              req.body.subject ||
              template.subject,

            bodyHtml,

            bodyText:
              req.body.bodyText?.trim() ||
              template.bodyText ||
              richTextToPlainText(
                bodyHtml,
              ),

            status:
              "DRAFT",

            metadata: {
              ...(
                req.body.metadata ||
                {}
              ),

              createdFromOffer:
                true,

              sourceOfferId:
                offer.id,
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

      await linkOnboarding(
        contract.id,
        contract.candidateOnboardingId,
        transaction,
      );

      await transaction.commit();

      const created =
        await findContract(
          contract.id,
          businessId,
        );

      return successResponse(
        res,
        created,
        "Employment contract created from accepted offer",
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

  updateContract = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const contract =
        await db.EmploymentContract.findOne(
          {
            where: {
              id:
                req.params.id,

              businessId:
                req.user!.businessId,
            },
          },
        );

      if (!contract) {
        return errorResponse(
          res,
          "Employment contract not found",
          404,
        );
      }

      if (
        !EDITABLE_STATUSES.includes(
          contract.status,
        )
      ) {
        return errorResponse(
          res,
          `Contracts with status ${contract.status} cannot be edited`,
          400,
        );
      }

      const updates: any = {
        ...req.body,

        updatedById:
          req.user!.id,
      };

      const uuidFields = [
        "templateId",
        "candidateOnboardingId",
        "employeeRecordId",
        "departmentId",
        "positionId",
        "reportingManagerId",
      ];

      for (
        const field
        of uuidFields
      ) {
        if (
          req.body[field] !==
          undefined
        ) {
          updates[field] =
            nullableUuid(
              req.body[field],
            );
        }
      }

      const nullableFields = [
        "salary",
        "startDate",
        "endDate",
        "probationStartDate",
        "probationEndDate",
        "noticePeriodDays",
      ];

      for (
        const field
        of nullableFields
      ) {
        if (
          req.body[field] !==
          undefined
        ) {
          updates[field] =
            nullableValue(
              req.body[field],
            );
        }
      }

      if (
        req.body.bodyHtml !==
        undefined
      ) {
        const bodyHtml =
          sanitizeRichTextHtml(
            req.body.bodyHtml,
          );

        if (
          !hasMeaningfulRichText(
            bodyHtml,
          )
        ) {
          return errorResponse(
            res,
            "Contract content cannot be empty",
            400,
          );
        }

        updates.bodyHtml =
          bodyHtml;

        if (
          req.body.bodyText ===
          undefined
        ) {
          updates.bodyText =
            richTextToPlainText(
              bodyHtml,
            );
        }
      }

      await contract.update(
        updates,
      );

      if (
        req.body.candidateOnboardingId !==
        undefined
      ) {
        await linkOnboarding(
          contract.id,
          nullableUuid(
            req.body.candidateOnboardingId,
          ),
        );
      }

      const updated =
        await findContract(
          contract.id,
          req.user!.businessId,
        );

      return successResponse(
        res,
        updated,
        "Employment contract updated",
      );
    } catch (error: any) {
      return errorResponse(
        res,
        error.message,
        500,
      );
    }
  };

  deleteContract = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const contract =
        await db.EmploymentContract.findOne(
          {
            where: {
              id:
                req.params.id,

              businessId:
                req.user!.businessId,
            },
          },
        );

      if (!contract) {
        return errorResponse(
          res,
          "Employment contract not found",
          404,
        );
      }

      if (
        contract.status !==
        "DRAFT"
      ) {
        return errorResponse(
          res,
          "Only draft contracts can be deleted",
          400,
        );
      }

      if (
        contract.candidateOnboardingId
      ) {
        await db.CandidateOnboarding.update(
          {
            contractId:
              null,
          },
          {
            where: {
              id:
                contract.candidateOnboardingId,

              contractId:
                contract.id,
            },
          },
        );
      }

      await contract.destroy();

      return successResponse(
        res,
        null,
        "Employment contract deleted",
      );
    } catch (error: any) {
      return errorResponse(
        res,
        error.message,
        500,
      );
    }
  };

  previewContract = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const rendered =
        renderEmploymentContractDocument(
          {
            subject:
              req.body.subject ||
              "",

            bodyHtml:
              req.body.bodyHtml,

            bodyText:
              req.body.bodyText,

            data:
              req.body.data ||
              {},
          },
        );

      return successResponse(
        res,
        rendered,
        "Contract preview generated",
      );
    } catch (error: any) {
      return errorResponse(
        res,
        error.message,
        500,
      );
    }
  };

  previewSavedContract = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const contract =
        await findContract(
          req.params.id,
          req.user!.businessId,
        );

      if (!contract) {
        return errorResponse(
          res,
          "Employment contract not found",
          404,
        );
      }

      const companyName =
        await getBusinessName(
          req.user!.businessId,
        );

      const data =
        buildRenderData(
          contract,
          companyName,
        );

      const rendered =
        renderEmploymentContractDocument(
          {
            subject:
              contract.subject,

            bodyHtml:
              contract.bodyHtml,

            bodyText:
              contract.bodyText,

            data,
          },
        );

      return successResponse(
        res,
        {
          ...rendered,
          data,
        },
        "Contract preview generated",
      );
    } catch (error: any) {
      return errorResponse(
        res,
        error.message,
        500,
      );
    }
  };
}
