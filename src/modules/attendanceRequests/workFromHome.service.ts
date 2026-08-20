import { Op } from "sequelize";
import { db } from "../../models";

interface ValidateWfhInput {
  businessId: string;
  employeeUserId: string;
  fromAt: unknown;
  toAt: unknown;
  reason: unknown;
  category?: unknown;
}

interface ValidatedWfhRequest {
  fromAt: Date;
  toAt: Date;
  durationMinutes: number;
  category: "Full Day" | "Partial Day";
  reason: string;
}

const ACTIVE_WFH_STATUSES = ["pending", "approved"];

function createHttpError(
  message: string,
  statusCode = 400
): Error & { statusCode: number } {
  return Object.assign(new Error(message), {
    statusCode,
  });
}

function parseDate(value: unknown, fieldName: string): Date {
  const date = new Date(String(value || ""));

  if (Number.isNaN(date.getTime())) {
    throw createHttpError(
      `Valid ${fieldName} is required.`
    );
  }

  return date;
}

function normalizeCategory(
  value: unknown
): "Full Day" | "Partial Day" {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

  if (normalized === "partial_day") {
    return "Partial Day";
  }

  return "Full Day";
}

export class WorkFromHomeService {
  async validateCreate(
    input: ValidateWfhInput
  ): Promise<ValidatedWfhRequest> {
    const reason = String(input.reason || "").trim();

    if (reason.length < 5) {
      throw createHttpError(
        "A clear work-from-home reason is required."
      );
    }

    const fromAt = parseDate(input.fromAt, "start date");
    const toAt = parseDate(input.toAt, "end date");

    if (toAt.getTime() <= fromAt.getTime()) {
      throw createHttpError(
        "The end date must be after the start date."
      );
    }

    const durationMinutes = Math.round(
      (toAt.getTime() - fromAt.getTime()) / 60_000
    );

    if (durationMinutes <= 0) {
      throw createHttpError(
        "Work-from-home duration must be greater than zero."
      );
    }

    await this.assertEmployeeExists(
      input.businessId,
      input.employeeUserId
    );

    await this.assertNoOverlap(
      input.businessId,
      input.employeeUserId,
      fromAt,
      toAt
    );

    return {
      fromAt,
      toAt,
      durationMinutes,
      category: normalizeCategory(input.category),
      reason,
    };
  }

  async cancelPending(
    businessId: string,
    requestId: string,
    employeeUserId: string
  ) {
    const request = await db.AttendanceRequest.findOne({
      where: {
        id: requestId,
        businessId,
        employeeUserId,
        requestType: "work_from_home",
      },
    });

    if (!request) {
      throw createHttpError(
        "Work-from-home request not found.",
        404
      );
    }

    if (request.status !== "pending") {
      throw createHttpError(
        "Only pending work-from-home requests can be cancelled."
      );
    }

    const now = new Date();

    await request.update({
      status: "cancelled",
      actionedAt: now,
      actionedByUserId: employeeUserId,
      actionNote: "Cancelled by employee",
    });

    return db.AttendanceRequest.findOne({
      where: {
        id: requestId,
        businessId,
      },
      include: [
        {
          model: db.User,
          as: "employee",
          attributes: [
            "id",
            "fullName",
            "email",
            "phone",
          ],
        },
        {
          model: db.User,
          as: "actionedBy",
          attributes: ["id", "fullName", "email"],
        },
      ],
    });
  }

  private async assertEmployeeExists(
    businessId: string,
    employeeUserId: string
  ): Promise<void> {
    const employee = await db.User.findOne({
      where: {
        id: employeeUserId,
        businessId,
      },
      attributes: ["id"],
    });

    if (!employee) {
      throw createHttpError("Employee not found.", 404);
    }
  }

  private async assertNoOverlap(
    businessId: string,
    employeeUserId: string,
    fromAt: Date,
    toAt: Date
  ): Promise<void> {
    const overlappingRequest =
      await db.AttendanceRequest.findOne({
        where: {
          businessId,
          employeeUserId,
          requestType: "work_from_home",
          status: {
            [Op.in]: ACTIVE_WFH_STATUSES,
          },
          fromAt: {
            [Op.lt]: toAt,
          },
          toAt: {
            [Op.gt]: fromAt,
          },
        },
        attributes: ["id"],
      });

    if (overlappingRequest) {
      throw createHttpError(
        "A pending or approved work-from-home request already overlaps this period."
      );
    }

    if (!db.LeaveRequest) {
      return;
    }

    const fromDate = fromAt.toISOString().slice(0, 10);
    const toDate = toAt.toISOString().slice(0, 10);

    const overlappingLeave =
      await db.LeaveRequest.findOne({
        where: {
          businessId,
          employeeUserId,
          status: {
            [Op.in]: ["pending", "approved"],
          },
          startDate: {
            [Op.lte]: toDate,
          },
          endDate: {
            [Op.gte]: fromDate,
          },
        },
        attributes: ["id"],
      });
    if (overlappingLeave) {
      throw createHttpError(
        "This period overlaps an existing leave request."
      );
    }
  }
}
