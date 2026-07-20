import {
  Op,
  col,
  fn,
  where,
} from "sequelize";
import { db } from "../../../models";
import { DEFAULT_EXIT_REASONS } from "./defaultExitReasons";
import type {
  CreateExitReasonInput,
  ReorderExitReasonInput,
  UpdateExitReasonInput,
} from "./exitReason.types";
export class ExitReasonService {
  async list(
    businessId: string,
    options: {
      initiator?: string;
      includeInactive?: boolean;
    } = {},
  ) {
    const reasonWhere: any = {
      businessId,
    };

    if (!options.includeInactive) {
      reasonWhere.isActive = true;
    }

    if (
      options.initiator === "employee" ||
      options.initiator === "employer"
    ) {
      reasonWhere.allowedInitiator = {
        [Op.in]: [
          options.initiator,
          "both",
        ],
      };
    }

    return db.ExitReason.findAll({
      where: reasonWhere,
      order: [
        ["sortOrder", "ASC"],
        ["name", "ASC"],
      ],
    });
  }

  async findById(
    businessId: string,
    id: string,
  ) {
    const reason =
      await db.ExitReason.findOne({
        where: {
          id,
          businessId,
        },
      });

    if (!reason) {
      throw new Error(
        "Exit reason not found.",
      );
    }

    return reason;
  }

  async create(
    businessId: string,
    createdByUserId: string,
    input: CreateExitReasonInput,
  ) {
    await this.assertUniqueName(
      businessId,
      input.name,
    );

    return db.ExitReason.create({
      businessId,
      createdByUserId,
      ...input,
    });
  }

  async update(
    businessId: string,
    id: string,
    input: UpdateExitReasonInput,
  ) {
    const reason = await this.findById(
      businessId,
      id,
    );

    if (
      input.name &&
      input.name !== reason.name
    ) {
      await this.assertUniqueName(
        businessId,
        input.name,
        id,
      );
    }

    return reason.update(input);
  }

  async remove(
    businessId: string,
    id: string,
  ) {
    const reason = await this.findById(
      businessId,
      id,
    );

    const usageCount =
      await db.ExitProcess.count({
        where: {
          businessId,
          exitReasonId: id,
        },
      });

    if (usageCount > 0) {
      /*
       * Preserve the reason because historical
       * exit records reference it.
       */
      return reason.update({
        isActive: false,
      });
    }

    await reason.destroy();

    return {
      id,
      deleted: true,
    };
  }

  async reorder(
    businessId: string,
    rows: ReorderExitReasonInput[],
  ) {
    return db.sequelize.transaction(
      async (transaction: any) => {
        const ids = rows.map(
          (row) => row.id,
        );

        const existing =
          await db.ExitReason.findAll({
            where: {
              businessId,
              id: {
                [Op.in]: ids,
              },
            },
            transaction,
            lock: true,
          });

        if (
          existing.length !== ids.length
        ) {
          throw new Error(
            "One or more exit reasons were not found.",
          );
        }

        await Promise.all(
          rows.map((row) =>
            db.ExitReason.update(
              {
                sortOrder:
                  row.sortOrder,
              },
              {
                where: {
                  id: row.id,
                  businessId,
                },
                transaction,
              },
            ),
          ),
        );

        return db.ExitReason.findAll({
          where: {
            businessId,
          },
          order: [
            ["sortOrder", "ASC"],
            ["name", "ASC"],
          ],
          transaction,
        });
      },
    );
  }
  private async ensureDefaults(
  businessId: string,
) {
  const existingCount =
    await db.ExitReason.count({
      where: {
        businessId,
      },
      paranoid: false,
    });

  if (existingCount > 0) {
    return;
  }

  await db.ExitReason.bulkCreate(
    DEFAULT_EXIT_REASONS.map(
      (reason) => ({
        businessId,

        name: reason.name,
        description:
          reason.description,

        allowedInitiator:
          reason.allowedInitiator,

        requiresExplanation:
          reason.requiresExplanation,

        isActive: true,
        sortOrder: reason.sortOrder,

        createdByUserId: null,
      }),
    ),
  );
}

  private async assertUniqueName(
    businessId: string,
    name: string,
    excludedId?: string,
  ) {
    const reasonWhere: any = {
      businessId,

      [Op.and]: [
        where(
          fn(
            "LOWER",
            col("name"),
          ),
          name.toLowerCase(),
        ),
      ],
    };

    if (excludedId) {
      reasonWhere.id = {
        [Op.ne]: excludedId,
      };
    }

    const existing =
      await db.ExitReason.findOne({
        where: reasonWhere,
      });

    if (existing) {
      throw new Error(
        "An exit reason with this name already exists.",
      );
    }
  }
}
