import { Op, type Transaction } from "sequelize";
import { db } from "../../models";

interface ValidateWfhInput {
  businessId: string;
  employeeUserId: string;
  fromAt: unknown;
  toAt: unknown;
  reason: unknown;
  category?: unknown;
}

interface CreateWfhInput extends ValidateWfhInput {
  title: unknown;
  reasonCategory?: unknown;
}

interface UpdateWfhInput {
  fromAt?: unknown;
  toAt?: unknown;
  reason?: unknown;
  category?: unknown;
  reasonCategory?: unknown;
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
  statusCode = 400,
): Error & { statusCode: number } {
  return Object.assign(new Error(message), {
    statusCode,
  });
}

function parseDate(value: unknown, fieldName: string): Date {
  const date = new Date(String(value || ""));

  if (Number.isNaN(date.getTime())) {
    throw createHttpError(`Valid ${fieldName} is required.`);
  }

  return date;
}

function normalizeCategory(
  value: unknown,
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
  /**
   * Creates a WFH request atomically.
   *
   * The employee row is locked before checking overlaps. This serializes
   * concurrent WFH submissions for the same employee so two requests cannot
   * both pass the overlap check before either insert commits.
   */
  async createPending(input: CreateWfhInput) {
    const title = String(input.title || "").trim();
    if (!title) {
      throw createHttpError("title and reason are required.");
    }

    return db.sequelize.transaction(async (transaction) => {
      await this.lockEmployee(
        input.businessId,
        input.employeeUserId,
        transaction,
      );

      const validated = await this.validateCreate(input, {
        transaction,
        employeeAlreadyLocked: true,
      });

      return db.AttendanceRequest.create(
        {
          businessId: input.businessId,
          employeeUserId: input.employeeUserId,
          requestType: "work_from_home",
          category: validated.category,
          title,
          reason: validated.reason,
          fromAt: validated.fromAt,
          toAt: validated.toAt,
          durationMinutes: validated.durationMinutes,
          status: "pending",
          submittedAt: new Date(),
          reasonCategory:
            String(input.reasonCategory || input.category || "").trim() ||
            validated.category,
        },
        { transaction },
      );
    });
  }

  /**
   * Employees may edit only their own pending WFH request. The request row and
   * employee row are locked so an approval/update race cannot bypass the
   * pending-only rule and overlap validation is performed in the same
   * transaction as the update.
   */
  async updatePending(
    businessId: string,
    requestId: string,
    employeeUserId: string,
    data: UpdateWfhInput,
  ) {
    return db.sequelize.transaction(async (transaction) => {
      await this.lockEmployee(businessId, employeeUserId, transaction);

      const request = await db.AttendanceRequest.findOne({
        where: {
          id: requestId,
          businessId,
          employeeUserId,
          requestType: "work_from_home",
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!request) {
        throw createHttpError("Work-from-home request not found.", 404);
      }

      if (request.status !== "pending") {
        throw createHttpError(
          "Only pending work-from-home requests can be edited.",
          409,
        );
      }

      const validated = await this.validateCreate(
        {
          businessId,
          employeeUserId,
          fromAt: data.fromAt ?? request.fromAt,
          toAt: data.toAt ?? request.toAt,
          reason: data.reason ?? request.reason,
          category: data.category ?? request.category,
        },
        {
          transaction,
          employeeAlreadyLocked: true,
          excludeRequestId: requestId,
        },
      );

      await request.update(
        {
          category: validated.category,
          reason: validated.reason,
          fromAt: validated.fromAt,
          toAt: validated.toAt,
          durationMinutes: validated.durationMinutes,
          reasonCategory:
            data.reasonCategory !== undefined
              ? String(data.reasonCategory || "").trim() || validated.category
              : validated.category,
        },
        { transaction },
      );

      return request;
    });
  }

  async validateCreate(
    input: ValidateWfhInput,
    options: {
      transaction?: Transaction;
      employeeAlreadyLocked?: boolean;
      excludeRequestId?: string;
    } = {},
  ): Promise<ValidatedWfhRequest> {
    const reason = String(input.reason || "").trim();

    if (reason.length < 5) {
      throw createHttpError("A clear work-from-home reason is required.");
    }

    const fromAt = parseDate(input.fromAt, "start date");
    const toAt = parseDate(input.toAt, "end date");

    if (toAt.getTime() <= fromAt.getTime()) {
      throw createHttpError("The end date must be after the start date.");
    }

    const durationMinutes = Math.round(
      (toAt.getTime() - fromAt.getTime()) / 60_000,
    );

    if (durationMinutes <= 0) {
      throw createHttpError(
        "Work-from-home duration must be greater than zero.",
      );
    }

    if (!options.employeeAlreadyLocked) {
      await this.assertEmployeeExists(
        input.businessId,
        input.employeeUserId,
        options.transaction,
      );
    }

    await this.assertNoOverlap(
      input.businessId,
      input.employeeUserId,
      fromAt,
      toAt,
      options.transaction,
      options.excludeRequestId,
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
    employeeUserId: string,
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
      throw createHttpError("Work-from-home request not found.", 404);
    }

    if (request.status !== "pending") {
      throw createHttpError(
        "Only pending work-from-home requests can be cancelled.",
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
          attributes: ["id", "fullName", "email", "phone"],
        },
        {
          model: db.User,
          as: "actionedBy",
          attributes: ["id", "fullName", "email"],
        },
      ],
    });
  }

  private async lockEmployee(
    businessId: string,
    employeeUserId: string,
    transaction: Transaction,
  ) {
    const employee = await db.User.findOne({
      where: {
        id: employeeUserId,
        businessId,
      },
      attributes: ["id"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!employee) {
      throw createHttpError("Employee not found.", 404);
    }

    return employee;
  }

  private async assertEmployeeExists(
    businessId: string,
    employeeUserId: string,
    transaction?: Transaction,
  ): Promise<void> {
    const employee = await db.User.findOne({
      where: {
        id: employeeUserId,
        businessId,
      },
      attributes: ["id"],
      transaction,
    });

    if (!employee) {
      throw createHttpError("Employee not found.", 404);
    }
  }

  private async assertNoOverlap(
    businessId: string,
    employeeUserId: string,
    fromAt: Date,
    toAt: Date,
    transaction?: Transaction,
    excludeRequestId?: string,
  ): Promise<void> {
    const overlappingRequest = await db.AttendanceRequest.findOne({
      where: {
        businessId,
        employeeUserId,
        requestType: "work_from_home",
        status: {
          [Op.in]: ACTIVE_WFH_STATUSES,
        },
        ...(excludeRequestId
          ? {
              id: {
                [Op.ne]: excludeRequestId,
              },
            }
          : {}),
        fromAt: {
          [Op.lt]: toAt,
        },
        toAt: {
          [Op.gt]: fromAt,
        },
      },
      attributes: ["id"],
      transaction,
    });

    if (overlappingRequest) {
      throw createHttpError(
        "A pending or approved work-from-home request already overlaps this period.",
      );
    }

    if (!db.LeaveRequest) {
      return;
    }

    const fromDate = fromAt.toISOString().slice(0, 10);
    const toDate = toAt.toISOString().slice(0, 10);

    const overlappingLeave = await db.LeaveRequest.findOne({
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
      transaction,
    });

    if (overlappingLeave) {
      throw createHttpError("This period overlaps an existing leave request.");
    }
  }
}
