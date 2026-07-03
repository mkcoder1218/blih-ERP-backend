"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const templateTable = await queryInterface.describeTable("leave_templates");
    if (!templateTable.isVisibleForRequest) {
      await queryInterface.addColumn("leave_templates", "isVisibleForRequest", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
    }
    if (!templateTable.isDeprecated) {
      await queryInterface.addColumn("leave_templates", "isDeprecated", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    const requestTable = await queryInterface.describeTable("leave_requests");
    if (!requestTable.durationType) {
      await queryInterface.addColumn("leave_requests", "durationType", {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "FULL_DAY"
      });
    }
    if (!requestTable.halfDayPeriod) {
      await queryInterface.addColumn("leave_requests", "halfDayPeriod", {
        type: Sequelize.STRING(20),
        allowNull: true
      });
    }
    if (!requestTable.requestedDays) {
      await queryInterface.addColumn("leave_requests", "requestedDays", {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 1
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE leave_templates
      SET "isVisibleForRequest" = false,
          "isDeprecated" = true
      WHERE lower(replace(name, ' ', '')) = 'annual(halfday)';
    `);

    await queryInterface.sequelize.query(`
      UPDATE leave_requests lr
      SET "durationType" = 'HALF_DAY',
          "requestedDays" = 0.5,
          "totalDays" = 0.5
      FROM leave_templates lt
      WHERE lr."leaveTemplateId" = lt.id
        AND lower(replace(lt.name, ' ', '')) = 'annual(halfday)';
    `);

    await queryInterface.sequelize.query(`
      UPDATE leave_requests
      SET "requestedDays" = COALESCE("totalDays", 1)
      WHERE "durationType" = 'FULL_DAY';
    `);
  },

  async down(queryInterface) {
    const requestTable = await queryInterface.describeTable("leave_requests");
    if (requestTable.requestedDays) await queryInterface.removeColumn("leave_requests", "requestedDays");
    if (requestTable.halfDayPeriod) await queryInterface.removeColumn("leave_requests", "halfDayPeriod");
    if (requestTable.durationType) await queryInterface.removeColumn("leave_requests", "durationType");

    const templateTable = await queryInterface.describeTable("leave_templates");
    if (templateTable.isDeprecated) await queryInterface.removeColumn("leave_templates", "isDeprecated");
    if (templateTable.isVisibleForRequest) await queryInterface.removeColumn("leave_templates", "isVisibleForRequest");
  }
};
