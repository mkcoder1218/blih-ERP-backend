import {
  Op,
  type Transaction,
} from "sequelize";
import { db } from "../../models";

const OPEN_PROBATION_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "REVIEW_DUE",
  "MANAGER_REVIEW_PENDING",
  "HR_REVIEW_PENDING",
  "FINAL_APPROVAL_PENDING",
  "CONTRACT_PENDING",
];

interface CompetencyInput {
  name: string;
  description?: string | null;
  weight: number;
  isRequired?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

interface InitializeProbationInput {
  employeeUserId: string;
  startDate: string | Date;
  durationMonths: number;
  expectedEndDate?: string | Date;
  managerUserId?: string;
  finalApproverUserId?: string | null;
  source:
    | "MANUAL_EMPLOYEE_CREATION"
    | "PORTAL_REGISTRATION"
    | "EXISTING_EMPLOYEE"
    | "PROBATION_EXTENSION";
  status?: string;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

interface ListProbationsQuery {
  page?: number | string;
  size?: number | string;
  search?: string;
  status?: string;
  employeeUserId?: string;
  managerUserId?: string;
  departmentId?: string;
  positionId?: string;
  endingFrom?: string;
  endingTo?: string;
}

function asDateOnly(
  value: string | Date,
): string {
  let date: Date;

  if (value instanceof Date) {
    date = new Date(value);
  } else {
    const normalized = value.includes("T")
      ? value
      : `${value}T00:00:00.000Z`;

    date = new Date(normalized);
  }

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value.");
  }

  return date.toISOString().slice(0, 10);
}

function addCalendarMonths(
  dateValue: string | Date,
  months: number,
): string {
  const dateOnly = asDateOnly(dateValue);

  const source = new Date(
    `${dateOnly}T00:00:00.000Z`,
  );

  const originalDay = source.getUTCDate();

  source.setUTCDate(1);

  source.setUTCMonth(
    source.getUTCMonth() + months,
  );

  const lastDayOfTargetMonth = new Date(
    Date.UTC(
      source.getUTCFullYear(),
      source.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();

  source.setUTCDate(
    Math.min(
      originalDay,
      lastDayOfTargetMonth,
    ),
  );

  return source.toISOString().slice(0, 10);
}

function numericWeight(
  value: unknown,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function assertWeightsTotalOneHundred(
  items: Array<{
    weight: unknown;
  }>,
): void {
  const total = items.reduce(
    (sum, item) =>
      sum + numericWeight(item.weight),
    0,
  );

  if (Math.abs(total - 100) > 0.01) {
    throw new Error(
      `Competency weights must total 100%. Current total is ${total.toFixed(
        2,
      )}%.`,
    );
  }
}

function normalizePagination(
  pageValue?: number | string,
  sizeValue?: number | string,
): {
  page: number;
  size: number;
} {
  const parsedPage = Number(pageValue ?? 1);
  const parsedSize = Number(sizeValue ?? 20);

  const page =
    Number.isFinite(parsedPage) &&
    parsedPage > 0
      ? Math.floor(parsedPage)
      : 1;

  const size =
    Number.isFinite(parsedSize) &&
    parsedSize > 0
      ? Math.min(
          Math.floor(parsedSize),
          100,
        )
      : 20;

  return {
    page,
    size,
  };
}

export class ProbationService {
  async getPositionCompetencies(
    businessId: string,
    positionId: string,
  ) {
    const position =
      await db.Position.findOne({
        where: {
          id: positionId,
          businessId,
        },
      });

    if (!position) {
      throw new Error(
        "Position not found.",
      );
    }

    return db.PositionCompetency.findAll({
      where: {
        businessId,
        positionId,
      },
      order: [
        ["sortOrder", "ASC"],
        ["createdAt", "ASC"],
      ],
    });
  }

  async replacePositionCompetencies(
    businessId: string,
    positionId: string,
    userId: string,
    competencies: CompetencyInput[],
  ) {
    const position =
      await db.Position.findOne({
        where: {
          id: positionId,
          businessId,
        },
      });

    if (!position) {
      throw new Error(
        "Position not found.",
      );
    }

    assertWeightsTotalOneHundred(
      competencies,
    );

    return db.sequelize.transaction(
      async (
        transaction: Transaction,
      ) => {
        await db.PositionCompetency.destroy({
          where: {
            businessId,
            positionId,
          },
          force: true,
          transaction,
        });

        await db.PositionCompetency.bulkCreate(
          competencies.map(
            (
              competency,
              index,
            ) => ({
              businessId,
              positionId,
              name:
                competency.name.trim(),
              description:
                competency.description ||
                null,
              weight: numericWeight(
                competency.weight,
              ),
              isRequired:
                competency.isRequired !==
                false,
              sortOrder:
                competency.sortOrder ??
                index,
              isActive:
                competency.isActive !==
                false,
              createdByUserId: userId,
              updatedByUserId: userId,
            }),
          ),
          {
            transaction,
          },
        );

        return db.PositionCompetency.findAll(
          {
            where: {
              businessId,
              positionId,
            },
            order: [
              ["sortOrder", "ASC"],
              ["createdAt", "ASC"],
            ],
            transaction,
          },
        );
      },
    );
  }

  async initialize(
    businessId: string,
    actorUserId: string,
    input: InitializeProbationInput,
  ) {
    return db.sequelize.transaction(
      async (
        transaction: Transaction,
      ) => {
        const employeeRecord =
          await db.EmployeeRecord.findOne({
            where: {
              businessId,
              userId:
                input.employeeUserId,
            },
            transaction,
            lock:
              transaction.LOCK.UPDATE,
          });

        if (!employeeRecord) {
          throw new Error(
            "Employee record not found.",
          );
        }

        if (!employeeRecord.positionId) {
          throw new Error(
            "Assign a position before initializing probation.",
          );
        }

        if (
          !employeeRecord.departmentId
        ) {
          throw new Error(
            "Assign a department before initializing probation.",
          );
        }

        const managerUserId =
          input.managerUserId ||
          employeeRecord.managerUserId;

        if (!managerUserId) {
          throw new Error(
            "Assign a reporting manager before initializing probation.",
          );
        }

        if (
          String(managerUserId) ===
          String(input.employeeUserId)
        ) {
          throw new Error(
            "An employee cannot be their own probation manager.",
          );
        }

        const managerRecord =
          await db.EmployeeRecord.findOne({
            where: {
              businessId,
              userId: managerUserId,
            },
            transaction,
          });

        if (!managerRecord) {
          throw new Error(
            "The selected manager is not an employee in this business.",
          );
        }

        if (
          input.finalApproverUserId
        ) {
          const finalApprover =
            await db.User.findOne({
              where: {
                id:
                  input.finalApproverUserId,
                businessId,
              },
              transaction,
            });

          if (!finalApprover) {
            throw new Error(
              "Final approver not found in this business.",
            );
          }

          if (
            String(
              input.finalApproverUserId,
            ) ===
            String(
              input.employeeUserId,
            )
          ) {
            throw new Error(
              "An employee cannot approve their own probation.",
            );
          }
        }

        const existingProbation =
          await db.EmployeeProbation.findOne(
            {
              where: {
                businessId,
                employeeUserId:
                  input.employeeUserId,
                status: {
                  [Op.in]:
                    OPEN_PROBATION_STATUSES,
                },
              },
              transaction,
              lock:
                transaction.LOCK.UPDATE,
            },
          );

        if (existingProbation) {
          throw new Error(
            "This employee already has an open probation lifecycle.",
          );
        }

        const competencies =
          await db.PositionCompetency.findAll(
            {
              where: {
                businessId,
                positionId:
                  employeeRecord.positionId,
                isActive: true,
              },
              order: [
                ["sortOrder", "ASC"],
                ["createdAt", "ASC"],
              ],
              transaction,
            },
          );

        if (!competencies.length) {
          throw new Error(
            "The employee position has no active probation competencies.",
          );
        }

        assertWeightsTotalOneHundred(
          competencies.map(
            (competency: any) => ({
              weight:
                competency.weight,
            }),
          ),
        );

        const durationMonths =
          Number(input.durationMonths);

        if (
          !Number.isInteger(
            durationMonths,
          ) ||
          durationMonths < 1 ||
          durationMonths > 36
        ) {
          throw new Error(
            "Probation duration must be between 1 and 36 months.",
          );
        }

        const startDate =
          asDateOnly(input.startDate);

        const calculatedEndDate =
          addCalendarMonths(
            startDate,
            durationMonths,
          );

        const expectedEndDate =
          input.expectedEndDate
            ? asDateOnly(
                input.expectedEndDate,
              )
            : calculatedEndDate;

        if (
          expectedEndDate < startDate
        ) {
          throw new Error(
            "Probation end date cannot be before its start date.",
          );
        }

        const probation =
          await db.EmployeeProbation.create(
            {
              businessId,
              employeeRecordId:
                employeeRecord.id,
              employeeUserId:
                input.employeeUserId,
              positionId:
                employeeRecord.positionId,
              departmentId:
                employeeRecord.departmentId,
              managerUserId,
              finalApproverUserId:
                input.finalApproverUserId ||
                null,
              source: input.source,
              status:
                input.status ||
                "ACTIVE",
              startDate,
              expectedEndDate,
              durationMonths,
              notes:
                input.notes || null,
              createdByUserId:
                actorUserId,
              updatedByUserId:
                actorUserId,
              metadata:
                input.metadata || {},
            },
            {
              transaction,
            },
          );

        await db.EmployeeProbationCriterion.bulkCreate(
          competencies.map(
            (
              competency: any,
            ) => ({
              businessId,
              probationId:
                probation.id,
              sourcePositionCompetencyId:
                competency.id,
              name: competency.name,
              description:
                competency.description,
              weight:
                competency.weight,
              isRequired:
                competency.isRequired,
              sortOrder:
                competency.sortOrder,
            }),
          ),
          {
            transaction,
          },
        );

        await employeeRecord.update(
          {
            managerUserId,
            probationEndDate:
              new Date(
                `${expectedEndDate}T00:00:00.000Z`,
              ),
            probationCompletedAt:
              null,
            completionEmailSentAt:
              null,
          },
          {
            transaction,
          },
        );

        return this.getById(
          businessId,
          probation.id,
          transaction,
        );
      },
    );
  }

  async getById(
    businessId: string,
    probationId: string,
    transaction?: Transaction,
  ) {
    const probation =
      await db.EmployeeProbation.findOne({
        where: {
          id: probationId,
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
            ],
          },
          {
            model: db.User,
            as: "manager",
            attributes: [
              "id",
              "fullName",
              "email",
            ],
          },
          {
            model: db.User,
            as: "finalApprover",
            attributes: [
              "id",
              "fullName",
              "email",
            ],
            required: false,
          },
          {
            model: db.Department,
            as: "department",
            attributes: [
              "id",
              "name",
            ],
          },
          {
            model: db.Position,
            as: "position",
            attributes: [
              "id",
              "title",
            ],
          },
          {
            model:
              db.EmployeeProbationCriterion,
            as: "criteria",
            separate: true,
            order: [
              ["sortOrder", "ASC"],
              ["createdAt", "ASC"],
            ],
          },
        ],
        transaction,
      });

    if (!probation) {
      throw new Error(
        "Probation record not found.",
      );
    }

    return probation;
  }

  async list(
    businessId: string,
    query: ListProbationsQuery,
  ) {
    const { page, size } =
      normalizePagination(
        query.page,
        query.size,
      );

    const where: Record<string, any> = {
      businessId,
    };

    const directFilters = [
      "status",
      "employeeUserId",
      "managerUserId",
      "departmentId",
      "positionId",
    ] as const;

    for (const key of directFilters) {
      if (query[key]) {
        where[key] = query[key];
      }
    }

    if (
      query.endingFrom ||
      query.endingTo
    ) {
      where.expectedEndDate = {};

      if (query.endingFrom) {
        where.expectedEndDate[
          Op.gte
        ] = asDateOnly(
          query.endingFrom,
        );
      }

      if (query.endingTo) {
        where.expectedEndDate[
          Op.lte
        ] = asDateOnly(
          query.endingTo,
        );
      }
    }

    const normalizedSearch =
      query.search?.trim();

    const employeeWhere =
      normalizedSearch
        ? {
            [Op.or]: [
              {
                fullName: {
                  [Op.iLike]:
                    `%${normalizedSearch}%`,
                },
              },
              {
                email: {
                  [Op.iLike]:
                    `%${normalizedSearch}%`,
                },
              },
            ],
          }
        : undefined;

    const result =
      await db.EmployeeProbation.findAndCountAll(
        {
          where,
          include: [
            {
              model: db.User,
              as: "employee",
              attributes: [
                "id",
                "fullName",
                "email",
              ],
              where: employeeWhere,
              required:
                Boolean(
                  employeeWhere,
                ),
            },
            {
              model: db.User,
              as: "manager",
              attributes: [
                "id",
                "fullName",
                "email",
              ],
            },
            {
              model:
                db.Department,
              as: "department",
              attributes: [
                "id",
                "name",
              ],
            },
            {
              model: db.Position,
              as: "position",
              attributes: [
                "id",
                "title",
              ],
            },
          ],
          order: [
            [
              "expectedEndDate",
              "ASC",
            ],
            ["createdAt", "DESC"],
          ],
          limit: size,
          offset:
            (page - 1) * size,
          distinct: true,
        },
      );

    return {
      rows: result.rows,
      total: result.count,
      page,
      size,
      totalPages: Math.ceil(
        result.count / size,
      ),
    };
  }
}
