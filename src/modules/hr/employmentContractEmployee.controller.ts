import type {
  Request,
  Response,
} from "express";

import {
  db,
} from "../../models";

import {
  errorResponse,
  successResponse,
} from "../../utils/response";

const EMPLOYEE_PENDING_STATUSES = [
  "SENT",
  "VIEWED",
  "PARTIALLY_SIGNED",
];

function getClientIp(
  req: Request,
): string {
  const forwarded =
    req.headers["x-forwarded-for"];

  if (
    typeof forwarded ===
    "string"
  ) {
    return (
      forwarded
        .split(",")[0]
        ?.trim() || ""
    );
  }

  if (
    Array.isArray(
      forwarded,
    )
  ) {
    return (
      forwarded[0] || ""
    );
  }

  return (
    req.ip ||
    req.socket.remoteAddress ||
    ""
  );
}

async function findEmployeeRecord(
  userId: string,
  businessId: string,
) {
  return db.EmployeeRecord.findOne({
    where: {
      userId,
      businessId,
    },

    attributes: [
      "id",
      "userId",
      "businessId",
    ],
  });
}

async function findPendingContract(
  employeeRecordId: string,
  businessId: string,
) {
  return db.EmploymentContract.findOne({
    where: {
      businessId,
      employeeRecordId,
      employeeSignedAt: null,
      status:
        EMPLOYEE_PENDING_STATUSES,
    },

    include: [
      {
        model:
          db.EmploymentContractTemplate,

        as:
          "template",

        required:
          false,

        attributes: [
          "id",
          "name",
          "contractType",
        ],
      },

      {
        model:
          db.Department,

        as:
          "department",

        required:
          false,

        attributes: [
          "id",
          "name",
        ],
      },

      {
        model:
          db.Position,

        as:
          "position",

        required:
          false,

        attributes: [
          "id",
          "title",
        ],
      },

      {
        model:
          db.User,

        as:
          "reportingManager",

        required:
          false,

        attributes: [
          "id",
          "fullName",
          "email",
        ],
      },
    ],

    order: [
      [
        "sentAt",
        "DESC",
      ],
      [
        "createdAt",
        "DESC",
      ],
    ],
  });
}

export class EmploymentContractEmployeeController {
  getPendingContract = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const userId =
        req.user!.id;

      const businessId =
        req.user!.businessId;

      const employeeRecord =
        await findEmployeeRecord(
          userId,
          businessId,
        );

      if (!employeeRecord) {
        return successResponse(
          res,
          {
            required: false,
            contract: null,
          },
        );
      }

      const contract =
        await findPendingContract(
          employeeRecord.id,
          businessId,
        );

      if (!contract) {
        return successResponse(
          res,
          {
            required: false,
            contract: null,
          },
        );
      }

      if (
        contract.status ===
        "SENT"
      ) {
        await contract.update({
          status:
            "VIEWED",

          viewedAt:
            contract.viewedAt ||
            new Date(),

          updatedById:
            userId,
        });
      } else if (
        !contract.viewedAt
      ) {
        await contract.update({
          viewedAt:
            new Date(),

          updatedById:
            userId,
        });
      }

      const refreshed =
        await findPendingContract(
          employeeRecord.id,
          businessId,
        );

      return successResponse(
        res,
        {
          required: true,
          contract:
            refreshed,
        },
      );
    } catch (error: any) {
      return errorResponse(
        res,
        error.message ||
          "Failed to load assigned contract",
        500,
      );
    }
  };

  signContract = async (
    req: Request,
    res: Response,
  ) => {
    const transaction =
      await db.sequelize.transaction();

    try {
      const userId =
        req.user!.id;

      const businessId =
        req.user!.businessId;

      const employeeRecord =
        await findEmployeeRecord(
          userId,
          businessId,
        );

      if (!employeeRecord) {
        await transaction.rollback();

        return errorResponse(
          res,
          "Employee record not found",
          404,
        );
      }

      const contract =
        await db.EmploymentContract.findOne({
          where: {
            id:
              req.params.id,

            businessId,

            employeeRecordId:
              employeeRecord.id,
          },

          transaction,
          lock:
            transaction.LOCK.UPDATE,
        });

      if (!contract) {
        await transaction.rollback();

        return errorResponse(
          res,
          "Assigned employment contract not found",
          404,
        );
      }

      if (
        contract.employeeSignedAt
      ) {
        await transaction.rollback();

        return errorResponse(
          res,
          "This contract has already been signed",
          409,
        );
      }

      if (
        !EMPLOYEE_PENDING_STATUSES.includes(
          contract.status,
        )
      ) {
        await transaction.rollback();

        return errorResponse(
          res,
          `Contract with status ${contract.status} cannot be signed`,
          400,
        );
      }

      const consent =
        req.body.consent === true;

      if (!consent) {
        await transaction.rollback();

        return errorResponse(
          res,
          "You must confirm that you reviewed and accept the contract",
          400,
        );
      }

      const signatureDataUrl =
        String(
          req.body.signatureDataUrl ||
          "",
        ).trim();

      const validImage =
        signatureDataUrl.startsWith(
          "data:image/png;base64,",
        ) ||
        signatureDataUrl.startsWith(
          "data:image/jpeg;base64,",
        );

      if (!validImage) {
        await transaction.rollback();

        return errorResponse(
          res,
          "A valid employee signature is required",
          400,
        );
      }

      if (
        signatureDataUrl.length >
        1_000_000
      ) {
        await transaction.rollback();

        return errorResponse(
          res,
          "The signature image is too large",
          400,
        );
      }

      const signedAt =
        new Date();

      const currentMetadata =
        contract.metadata &&
        typeof contract.metadata ===
          "object"
          ? contract.metadata
          : {};

      const nextStatus =
        contract.employerSignedAt
          ? "SIGNED"
          : "PARTIALLY_SIGNED";

      await contract.update(
        {
          employeeSignedAt:
            signedAt,

          status:
            nextStatus,

          metadata: {
            ...currentMetadata,

            employeeSignature: {
              signatureDataUrl,

              signerUserId:
                userId,

              signerEmployeeRecordId:
                employeeRecord.id,

              signedAt:
                signedAt.toISOString(),

              ipAddress:
                getClientIp(
                  req,
                ),

              userAgent:
                String(
                  req.headers[
                    "user-agent"
                  ] || "",
                ),

              consent:
                true,
            },
          },

          updatedById:
            userId,
        },
        {
          transaction,
        },
      );

      await transaction.commit();

      return successResponse(
        res,
        {
          id:
            contract.id,

          contractNumber:
            contract.contractNumber,

          status:
            nextStatus,

          employeeSignedAt:
            signedAt,
        },
        "Employment contract signed successfully",
      );
    } catch (error: any) {
      await transaction.rollback();

      return errorResponse(
        res,
        error.message ||
          "Failed to sign employment contract",
        500,
      );
    }
  };
}
