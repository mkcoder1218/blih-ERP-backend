import { Op } from "sequelize";
import { db } from "../../models";
import {
  EmploymentChangeAction,
  EmploymentChangeRequest,
} from "./employmentChange.models";

const TITLE_CHANGE_TYPES = new Set([
  "PROMOTION",
  "LATERAL_TITLE_CHANGE",
  "DEMOTION",
  "CORRECTION",
]);

function fail(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export class EmploymentChangeUpdateService {
  private async ensureEditable(
    businessId: string,
    actorUserId: string,
    requestId: string,
  ) {
    const request = await EmploymentChangeRequest.findOne({
      where: { id: requestId, businessId },
    });

    if (!request) {
      fail("Employment change request not found.", 404);
    }

    if (String(request.requestedByUserId) !== String(actorUserId)) {
      fail("You can only update requests you created.", 403);
    }

    if (String(request.status) !== "PENDING") {
      fail("Only pending requests can be updated.", 409);
    }

    const approvalIndex = Number(request.metadata?.approvalIndex || 0);
    if (approvalIndex > 0) {
      fail("This request has already moved through an approval stage and can no longer be edited.", 409);
    }

    const reviewedAction = await EmploymentChangeAction.findOne({
      where: {
        businessId,
        requestId,
        action: {
          [Op.notIn]: ["SUBMITTED", "UPDATED"],
        },
      },
      attributes: ["id", "action"],
    });

    if (reviewedAction) {
      fail("This request has already been reviewed and can no longer be edited.", 409);
    }

    return request;
  }

  private async targetPosition(
    businessId: string,
    targetPositionId?: string | null,
  ) {
    if (!targetPositionId) return null;

    const position = await db.Position.findOne({
      where: {
        id: String(targetPositionId),
        businessId,
        status: "active",
      },
      attributes: ["id", "title", "departmentId"],
    });

    if (!position) {
      fail("Selected target position was not found.", 404);
    }

    return position;
  }

  async updateOwn(
    businessId: string,
    actorUserId: string,
    requestId: string,
    data: any,
  ) {
    const request = await this.ensureEditable(
      businessId,
      actorUserId,
      requestId,
    );

    const before = request.toJSON();
    const hasTitleChange = ["TITLE", "COMBINED"].includes(
      String(request.requestKind),
    );
    const hasSalaryChange = ["SALARY", "COMBINED"].includes(
      String(request.requestKind),
    );

    const reason = String(data.reason ?? request.reason ?? "").trim();
    if (!reason) {
      fail("Reason / justification is required.");
    }

    const effectiveDate = String(
      data.effectiveDate ?? request.effectiveDate,
    ).slice(0, 10);
    if (!validDate(effectiveDate)) {
      fail("effectiveDate must be YYYY-MM-DD.");
    }

    let targetPosition: any = null;
    let targetPositionId: string | null = request.targetPositionId || null;
    let targetTitle: string | null = request.targetTitle || null;
    let targetDepartmentId: string | null = request.targetDepartmentId || null;
    let titleChangeType: string | null = request.titleChangeType || null;

    if (hasTitleChange) {
      if (data.targetPositionId !== undefined) {
        targetPositionId = String(data.targetPositionId || "").trim() || null;
      }

      targetPosition = await this.targetPosition(
        businessId,
        targetPositionId,
      );

      if (targetPosition) {
        targetTitle = String(targetPosition.title || "").trim() || null;
        targetDepartmentId = String(
          data.targetDepartmentId || targetPosition.departmentId || targetDepartmentId || "",
        ).trim() || null;
      } else if (data.targetTitle !== undefined) {
        targetTitle = String(data.targetTitle || "").trim() || null;
      }

      if (!targetPosition && !targetTitle) {
        fail("Select a target position or enter a new title.");
      }

      if (data.targetDepartmentId !== undefined && !targetPosition) {
        targetDepartmentId = String(data.targetDepartmentId || "").trim() || null;
      }

      if (targetDepartmentId) {
        const department = await db.Department.findOne({
          where: { id: targetDepartmentId, businessId },
          attributes: ["id"],
        });
        if (!department) {
          fail("Target department not found.", 404);
        }
      }

      titleChangeType = String(
        data.titleChangeType ?? titleChangeType ?? "LATERAL_TITLE_CHANGE",
      ).toUpperCase();

      if (!TITLE_CHANGE_TYPES.has(titleChangeType)) {
        fail("Invalid titleChangeType.");
      }
    } else {
      targetPositionId = null;
      targetTitle = null;
      targetDepartmentId = null;
      titleChangeType = null;
    }

    let requestedSalary: number | null = request.requestedSalary ?? null;
    if (hasSalaryChange) {
      if (
        data.requestedSalary !== undefined &&
        data.requestedSalary !== null &&
        data.requestedSalary !== ""
      ) {
        requestedSalary = Number(data.requestedSalary);
      } else if (
        data.increasePercent !== undefined &&
        data.increasePercent !== null &&
        data.increasePercent !== ""
      ) {
        requestedSalary =
          Number(request.currentSalary || 0) *
          (1 + Number(data.increasePercent) / 100);
      }

      const currentSalary = Number(request.currentSalary || 0);
      if (
        requestedSalary === null ||
        !Number.isFinite(requestedSalary) ||
        requestedSalary <= 0
      ) {
        fail("Requested salary must be a positive number.");
      }
      if (requestedSalary <= currentSalary) {
        fail("Salary increase request must be greater than the current salary.");
      }
    } else {
      requestedSalary = null;
    }

    const attachmentUrl =
      data.attachmentUrl === undefined
        ? request.attachmentUrl || null
        : String(data.attachmentUrl || "").trim() || null;

    await request.update({
      titleChangeType,
      targetPositionId,
      targetTitle,
      targetDepartmentId,
      requestedSalary,
      recommendedSalary: null,
      reason,
      effectiveDate,
      attachmentUrl,
      metadata: {
        ...(request.metadata || {}),
        lastUpdatedByUserId: actorUserId,
        lastUpdatedAt: new Date().toISOString(),
      },
    });

    await EmploymentChangeAction.create({
      businessId,
      requestId: request.id,
      actorUserId,
      stage: "SUBMISSION",
      action: "UPDATED",
      comment: "Request updated by submitter.",
      beforeData: before,
      afterData: request.toJSON(),
    });

    return {
      request: await request.reload(),
      before,
    };
  }
}
