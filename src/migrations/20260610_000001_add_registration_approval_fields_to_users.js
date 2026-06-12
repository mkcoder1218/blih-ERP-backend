"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Migration: add self-registration approval workflow fields to users table.
 *
 * New columns:
 *   registrationToken  — unique token stored on pending users, used in the
 *                        resubmit link sent via email after rejection
 *   rejectionReason    — HR's written reason, stored so the applicant can
 *                        see it when they open the resubmit link
 *   rejectedAt         — timestamp of the most recent rejection
 *   approvedAt         — timestamp when HR approved the account
 *   approvedByUserId   — FK to the HR user who approved
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "users"))) {
      return;
    }

    const table = await queryInterface.describeTable("users");

    if (!table.registrationToken) {
      await queryInterface.addColumn("users", "registrationToken", {
        type: Sequelize.STRING(128),
        allowNull: true,
      });
    }

    if (!table.rejectionReason) {
      await queryInterface.addColumn("users", "rejectionReason", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!table.rejectedAt) {
      await queryInterface.addColumn("users", "rejectedAt", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!table.approvedAt) {
      await queryInterface.addColumn("users", "approvedAt", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!table.approvedByUserId) {
      await queryInterface.addColumn("users", "approvedByUserId", {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, "users"))) {
      return;
    }

    const table = await queryInterface.describeTable("users");

    if (table.approvedByUserId)   await queryInterface.removeColumn("users", "approvedByUserId");
    if (table.approvedAt)         await queryInterface.removeColumn("users", "approvedAt");
    if (table.rejectedAt)         await queryInterface.removeColumn("users", "rejectedAt");
    if (table.rejectionReason)    await queryInterface.removeColumn("users", "rejectionReason");
    if (table.registrationToken)  await queryInterface.removeColumn("users", "registrationToken");
  },
};
