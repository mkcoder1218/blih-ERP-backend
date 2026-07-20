import { Op } from "sequelize";

import { db } from "../../../models";

import type {
  CreateExitInput,
  ReviewExitInput,
} from "./exit.types";

import {
  resolveNoticePeriodDays,
  validateEffectiveDate,
  validateExitMode,
  validateExitType,
  validateInitiatorAndType,
  validateLetter,
  validateReasonExplanation,
} from "./exit.validation";

interface BuildExitInput {
  businessId: string;
  employeeUserId: string;
  initiatedByUserId: string;
  initiatedByType:
    | "employee"
    | "employer";

  body: any;
}

export class ExitWorkflowService {
  async create(
    input: BuildExitInput,
    transaction?: any,
  ) {
    const {
      businessId,
      employeeUserId,
      initiatedByUserId,
      initiatedByType,
      body,
    } = input;

    const exitMode =
      validateExitMode(
        body.exitMode,
      );

    const exitType =
      validateExitType(
        body.exitType,
      );

    validateInitiatorAndType(
      initiatedByType,
      exitType,
    );

    const noticePeriodDays =
      resolveNoticePeriodDays(
        exitMode,
        body.noticePeriodDays,
      );

    const effectiveDate =
      validateEffectiveDate(
        body.effectiveDate,
        noticePeriodDays,
      );

    const letterHtml =
      validateLetter(
        body.letterHtml,
      );

    const reason =
      await this.getValidatedReason(
        businessId,
        body.exitReasonId,
        initiatedByType,
        body.reason,
        transaction,
      );

    await this.assertEmployeeExists(
      businessId,
      employeeUserId,
      transaction,
    );

    const existing =
      await db.ExitProcess.findOne({
        where: {
          businessId,
          employeeUserId,

          status: {
            [Op.notIn]: [
              "completed",
              "account_disabled",
              "rejected",
              "cancelled",
            ],
          },
        },

        transaction,
        lock: transaction
          ? transaction.LOCK.UPDATE
          : undefined,
      });

    if (existing) {
      throw new Error(
        "This employee already has an active exit process.",
      );
    }

    const payload: CreateExitInput = {
      employeeUserId,
      initiatedByUserId,
      initiatedByType,

      exitType,
      exitMode,

      noticePeriodDays,
      effectiveDate,

      exitReasonId: reason.id,
      exitReasonNameSnapshot:
        reason.name,

      reason:
        validateReasonExplanation(
          body.reason,
          Boolean(
            reason.requiresExplanation,
          ),
        ),

      letterHtml,

      templateId:
        body.templateId || null,

      templateSnapshot:
        body.templateSnapshot || null,

      formValues:
        body.formValues || {},
    };

    return db.ExitProcess.create(
      {
        businessId,

        ...payload,

        status: "pending",

        clearanceData: {
          templateId:
            payload.templateId,

          templateSnapshot:
            payload.templateSnapshot,

          formValues:
            payload.formValues,
        },

        finalPayData: {
          status: "pending",
        },
      },

      {
        transaction,
      },
    );
  }

  async approve(
    businessId: string,
    exitId: string,
    input: ReviewExitInput,
  ) {
    const exitProcess =
      await this.findForUpdate(
        businessId,
        exitId,
      );

    if (
      exitProcess.status !== "pending"
    ) {
      throw new Error(
        "Only pending exit requests can be approved.",
      );
    }

    const effectiveDate =
      input.effectiveDate
        ? validateEffectiveDate(
            input.effectiveDate,
            Number(
              exitProcess.noticePeriodDays,
            ),
          )
        : exitProcess.effectiveDate;

    return exitProcess.update({
      status: "clearance_pending",

      effectiveDate,

      reviewedByUserId:
        input.reviewedByUserId,

      reviewedAt: new Date(),

      approvalNote:
        input.approvalNote || null,

      rejectionReason: null,
    });
  }

  async reject(
    businessId: string,
    exitId: string,
    input: ReviewExitInput,
  ) {
    const exitProcess =
      await this.findForUpdate(
        businessId,
        exitId,
      );

    if (
      exitProcess.status !== "pending"
    ) {
      throw new Error(
        "Only pending exit requests can be rejected.",
      );
    }

    const rejectionReason =
      String(
        input.rejectionReason || "",
      ).trim();

    if (
      rejectionReason.length < 3
    ) {
      throw new Error(
        "A rejection reason is required.",
      );
    }

    return exitProcess.update({
      status: "rejected",

      reviewedByUserId:
        input.reviewedByUserId,

      reviewedAt: new Date(),

      rejectionReason,
    });
  }

  private async findForUpdate(
    businessId: string,
    exitId: string,
  ) {
    const exitProcess =
      await db.ExitProcess.findOne({
        where: {
          id: exitId,
          businessId,
        },
      });

    if (!exitProcess) {
      throw new Error(
        "Exit process not found.",
      );
    }

    return exitProcess;
  }

  private async assertEmployeeExists(
    businessId: string,
    employeeUserId: string,
    transaction?: any,
  ) {
    const employee =
      await db.EmployeeRecord.findOne({
        where: {
          businessId,
          userId: employeeUserId,
        },

        transaction,
      });

    if (!employee) {
      throw new Error(
        "Employee record not found.",
      );
    }
  }

  private async getValidatedReason(
    businessId: string,
    reasonId: unknown,
    initiatedByType:
      | "employee"
      | "employer",
    explanation: unknown,
    transaction?: any,
  ) {
    const id = String(
      reasonId || "",
    ).trim();

    if (!id) {
      throw new Error(
        "exitReasonId is required.",
      );
    }

    const reason =
      await db.ExitReason.findOne({
        where: {
          id,
          businessId,
          isActive: true,
        },

        transaction,
      });

    if (!reason) {
      throw new Error(
        "The selected exit reason is unavailable.",
      );
    }

    if (
      ![
        initiatedByType,
        "both",
      ].includes(
        String(
          reason.allowedInitiator,
        ),
      )
    ) {
      throw new Error(
        "The selected exit reason cannot be used for this exit initiator.",
      );
    }

    validateReasonExplanation(
      explanation,
      Boolean(
        reason.requiresExplanation,
      ),
    );

    return reason;
  }
}
