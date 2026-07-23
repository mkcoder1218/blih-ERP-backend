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

interface SignaturePayload {
  signatureDataUrl?: unknown;
  consent?: unknown;
}

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

function isValidSignatureDataUrl(
  value: string,
): boolean {
  return (
    value.startsWith(
      "data:image/png;base64,",
    ) ||
    value.startsWith(
      "data:image/jpeg;base64,",
    )
  );
}

export class EmploymentContractEmployerController {
  signContract = async (
    req: Request,
    res: Response,
  ) => {
    const transaction =
      await db.sequelize.transaction();

    let transactionCompleted =
      false;

    const rollback = async () => {
      if (
        transactionCompleted
      ) {
        return;
      }

      await transaction.rollback();

      transactionCompleted =
        true;
    };

    try {
      const businessId =
        req.user!.businessId;

      const signerUserId =
        req.user!.id;

      const contractId =
        String(
          req.params.id ||
            "",
        ).trim();

      const body =
        (
          req.body ||
          {}
        ) as SignaturePayload;

      if (!contractId) {
        await rollback();

        return errorResponse(
          res,
          "Contract ID is required",
          400,
        );
      }

      if (
        body.consent !==
        true
      ) {
        await rollback();

        return errorResponse(
          res,
          "You must confirm that you reviewed and approved the contract",
          400,
        );
      }

      const signatureDataUrl =
        String(
          body.signatureDataUrl ||
            "",
        ).trim();

      if (
        !isValidSignatureDataUrl(
          signatureDataUrl,
        )
      ) {
        await rollback();

        return errorResponse(
          res,
          "A valid employer signature is required",
          400,
        );
      }

      if (
        signatureDataUrl.length >
        1_000_000
      ) {
        await rollback();

        return errorResponse(
          res,
          "The employer signature image is too large",
          400,
        );
      }

      const contract =
        await db.EmploymentContract.findOne({
          where: {
            id:
              contractId,

            businessId,
          },

          transaction,

          lock:
            transaction.LOCK.UPDATE,
        });

      if (!contract) {
        await rollback();

        return errorResponse(
          res,
          "Employment contract not found",
          404,
        );
      }

      if (
        contract.employerSignedAt
      ) {
        await rollback();

        return errorResponse(
          res,
          "This contract has already been signed by the employer",
          409,
        );
      }

      if (
        !contract.employeeSignedAt
      ) {
        await rollback();

        return errorResponse(
          res,
          "The employee must sign the contract before the employer can countersign it",
          400,
        );
      }

      const allowedStatuses = [
        "PARTIALLY_SIGNED",
        "VIEWED",
        "SENT",
      ];

      if (
        !allowedStatuses.includes(
          contract.status,
        )
      ) {
        await rollback();

        return errorResponse(
          res,
          `Contract with status ${contract.status} cannot be countersigned`,
          400,
        );
      }

      const signer =
        await db.User.findOne({
          where: {
            id:
              signerUserId,

            businessId,
          },

          attributes: [
            "id",
            "fullName",
            "email",
          ],

          transaction,
        });

      if (!signer) {
        await rollback();

        return errorResponse(
          res,
          "Signing user not found",
          404,
        );
      }

      const signedAt =
        new Date();

      const existingMetadata =
        contract.metadata &&
        typeof contract.metadata ===
          "object"
          ? contract.metadata
          : {};

      const employerSignature = {
        signatureDataUrl,

        signerUserId,

        signerName:
          signer.fullName,

        signerEmail:
          signer.email,

        signerRoles:
          req.user!.roles ||
          [],

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
      };

      await contract.update(
        {
          employerSignedAt:
            signedAt,

          status:
            "SIGNED",

          metadata: {
            ...existingMetadata,

            employerSignature,
          },

          updatedById:
            signerUserId,
        },
        {
          transaction,
        },
      );

      await transaction.commit();

      transactionCompleted =
        true;

      return successResponse(
        res,
        {
          contract: {
            id:
              contract.id,

            contractNumber:
              contract.contractNumber,

            status:
              "SIGNED",

            employeeSignedAt:
              contract.employeeSignedAt,

            employerSignedAt:
              signedAt,

            metadata: {
              ...existingMetadata,

              employerSignature,
            },
          },
        },
        "Employment contract countersigned successfully",
      );
    } catch (
      error: any
    ) {
      try {
        await rollback();
      } catch (
        rollbackError
      ) {
        console.error(
          "Failed to rollback employment contract signature transaction:",
          rollbackError,
        );
      }

      return errorResponse(
        res,
        error.message ||
          "Failed to countersign employment contract",
        500,
      );
    }
  };
}
