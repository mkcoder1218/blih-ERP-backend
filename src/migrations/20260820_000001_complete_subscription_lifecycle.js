"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const hasColumn = async (table, column) => {
      const columns = await queryInterface.describeTable(table);
      return Boolean(columns[column]);
    };
    const addColumn = async (table, column, definition) => {
      if (!(await hasColumn(table, column))) {
        await queryInterface.addColumn(table, column, definition);
      }
    };
    const tableExists = async (table) => {
      const tables = await queryInterface.showAllTables();
      return tables.some((entry) => {
        const name = typeof entry === "string" ? entry : entry.tableName || entry.table_name || entry.name;
        return String(name).toLowerCase() === table.toLowerCase();
      });
    };

    await addColumn("plans", "priceYearly", {
      type: Sequelize.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await addColumn("plan_features", "overageUnitPrice", {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: false,
      defaultValue: 0,
    });
    await addColumn("subscriptions", "pastDueSince", { type: Sequelize.DATE, allowNull: true });
    await addColumn("subscriptions", "creditBalance", {
      type: Sequelize.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await addColumn("subscriptions", "discountPercent", {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await addColumn("subscriptions", "retentionUntil", { type: Sequelize.DATE, allowNull: true });

    // Existing installations may have PostgreSQL enum-backed status columns.
    // Add the new lifecycle values without destructively rebuilding the enum.
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_subscriptions_status') THEN
          ALTER TYPE enum_subscriptions_status ADD VALUE IF NOT EXISTS 'pending_payment';
          ALTER TYPE enum_subscriptions_status ADD VALUE IF NOT EXISTS 'suspended';
        END IF;
      END $$;
    `);

    if (!(await tableExists("subscription_policies"))) {
      await queryInterface.createTable("subscription_policies", {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
        scopeKey: { type: Sequelize.STRING(180), allowNull: false, unique: true },
        scopeType: { type: Sequelize.STRING(30), allowNull: false },
        planId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: "plans", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: "businesses", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        gracePeriodDays: { type: Sequelize.INTEGER, allowNull: true },
        graceAccessMode: { type: Sequelize.STRING(40), allowNull: true },
        expiredAccessMode: { type: Sequelize.STRING(40), allowNull: true },
        retentionDays: { type: Sequelize.INTEGER, allowNull: true },
        downgradePolicy: { type: Sequelize.STRING(40), allowNull: true },
        autoRenew: { type: Sequelize.BOOLEAN, allowNull: true },
        metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex("subscription_policies", ["scopeType"]);
      await queryInterface.addIndex("subscription_policies", ["planId"]);
      await queryInterface.addIndex("subscription_policies", ["businessId"]);
    }

    // Existing monthly plans get a sensible yearly starting value. Platform admins
    // can immediately replace it in the Plan Builder.
    await queryInterface.sequelize.query(`
      UPDATE plans
      SET "priceYearly" = CASE
        WHEN COALESCE("priceYearly", 0) = 0 THEN COALESCE(NULLIF("priceMonthly", 0), "basePrice", 0) * 12
        ELSE "priceYearly"
      END
    `);

    const [platformPolicy] = await queryInterface.sequelize.query(
      `SELECT id FROM subscription_policies WHERE "scopeKey" = 'platform' LIMIT 1`,
    );
    if (!platformPolicy.length) {
      await queryInterface.bulkInsert("subscription_policies", [
        {
          id: require("crypto").randomUUID(),
          scopeKey: "platform",
          scopeType: "platform",
          planId: null,
          businessId: null,
          gracePeriodDays: 7,
          graceAccessMode: "read_only",
          expiredAccessMode: "billing_only",
          retentionDays: 90,
          downgradePolicy: "block",
          autoRenew: false,
          metadata: JSON.stringify({}),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    }
  },

  async down(queryInterface) {
    const safeRemove = async (table, column) => {
      try {
        const columns = await queryInterface.describeTable(table);
        if (columns[column]) await queryInterface.removeColumn(table, column);
      } catch {
        // Best-effort rollback for mixed historical installations.
      }
    };

    if ((await queryInterface.showAllTables()).some((t) => String(typeof t === "string" ? t : t.tableName || t.table_name || t.name).toLowerCase() === "subscription_policies")) {
      await queryInterface.dropTable("subscription_policies");
    }
    await safeRemove("subscriptions", "retentionUntil");
    await safeRemove("subscriptions", "discountPercent");
    await safeRemove("subscriptions", "creditBalance");
    await safeRemove("subscriptions", "pastDueSince");
    await safeRemove("plan_features", "overageUnitPrice");
    await safeRemove("plans", "priceYearly");
  },
};
