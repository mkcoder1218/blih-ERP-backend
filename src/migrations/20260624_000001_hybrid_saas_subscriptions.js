"use strict";
const { randomUUID } = require("crypto");

module.exports = {
  async up(q, S) {
    const tableExists = async (table) => {
      const tables = await q.showAllTables();
      return tables.some((entry) => {
        const name = typeof entry === "string"
          ? entry
          : entry.tableName || entry.table_name || entry.name;
        return String(name).toLowerCase() === table.toLowerCase();
      });
    };
    const createTable = async (table, columns) => {
      if (!await tableExists(table)) await q.createTable(table, columns);
    };
    const add = async (table, name, definition) => {
      const columns = await q.describeTable(table);
      if (!columns[name]) await q.addColumn(table, name, definition);
    };
    await add("plans", "description", { type: S.TEXT, allowNull: true });
    await add("plans", "basePrice", { type: S.DECIMAL(14, 2), allowNull: false, defaultValue: 0 });
    await add("plans", "billingCycle", { type: S.STRING(20), allowNull: false, defaultValue: "monthly" });
    await add("plans", "includedSeats", { type: S.INTEGER, allowNull: false, defaultValue: 0 });
    await add("plans", "extraSeatPrice", { type: S.DECIMAL(14, 2), allowNull: false, defaultValue: 0 });
    await add("plans", "currency", { type: S.STRING(3), allowNull: false, defaultValue: "ETB" });
    await add("plans", "isActive", { type: S.BOOLEAN, allowNull: false, defaultValue: true });
    await add("plans", "sortOrder", { type: S.INTEGER, allowNull: false, defaultValue: 0 });

    await createTable("features", {
      id: { type: S.UUID, primaryKey: true }, key: { type: S.STRING(100), allowNull: false, unique: true },
      name: { type: S.STRING(150), allowNull: false }, description: S.TEXT, category: S.STRING(100),
      isMetered: { type: S.BOOLEAN, allowNull: false, defaultValue: false }, unitName: S.STRING(50),
      createdAt: { type: S.DATE, allowNull: false }, updatedAt: { type: S.DATE, allowNull: false }
    });
    await createTable("plan_features", {
      id: { type: S.UUID, primaryKey: true }, planId: { type: S.UUID, allowNull: false, references: { model: "plans", key: "id" }, onDelete: "CASCADE" },
      featureId: { type: S.UUID, allowNull: false, references: { model: "features", key: "id" }, onDelete: "CASCADE" },
      isEnabled: { type: S.BOOLEAN, allowNull: false, defaultValue: false }, limitValue: S.DECIMAL(14, 2), limitPeriod: S.STRING(20),
      createdAt: { type: S.DATE, allowNull: false }, updatedAt: { type: S.DATE, allowNull: false }
    });
    const planFeatureIndexes = await q.showIndex("plan_features");
    if (!planFeatureIndexes.some((index) => index.name === "plan_features_plan_feature_unique")) {
      await q.addConstraint("plan_features", { type: "unique", fields: ["planId", "featureId"], name: "plan_features_plan_feature_unique" });
    }
    await createTable("usage_records", {
      id: { type: S.UUID, primaryKey: true }, businessId: { type: S.UUID, allowNull: false, references: { model: "businesses", key: "id" } },
      subscriptionId: { type: S.UUID, allowNull: false, references: { model: "subscriptions", key: "id" } },
      featureId: { type: S.UUID, allowNull: false, references: { model: "features", key: "id" } },
      quantity: { type: S.DECIMAL(14, 2), allowNull: false }, unitPrice: { type: S.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      totalPrice: { type: S.DECIMAL(14, 2), allowNull: false, defaultValue: 0 }, usageDate: { type: S.DATE, allowNull: false },
      billingPeriod: { type: S.STRING(20), allowNull: false }, metadata: { type: S.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: S.DATE, allowNull: false }, updatedAt: { type: S.DATE, allowNull: false }
    });

    await add("subscriptions", "currentPeriodStart", { type: S.DATE, allowNull: true });
    await add("subscriptions", "currentPeriodEnd", { type: S.DATE, allowNull: true });
    await add("subscriptions", "cancelAtPeriodEnd", { type: S.BOOLEAN, allowNull: false, defaultValue: false });
    await add("subscriptions", "canceledAt", { type: S.DATE });
    await add("subscriptions", "pendingPlanId", { type: S.UUID });
    for (const [name, def] of Object.entries({
      baseAmount: { type: S.DECIMAL(14, 2), allowNull: false, defaultValue: 0 }, seatAmount: { type: S.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      usageAmount: { type: S.DECIMAL(14, 2), allowNull: false, defaultValue: 0 }, discountAmount: { type: S.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      taxAmount: { type: S.DECIMAL(14, 2), allowNull: false, defaultValue: 0 }, totalAmount: { type: S.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      periodStart: { type: S.DATE }, periodEnd: { type: S.DATE }
    })) await add("subscription_invoices", name, def);
    await add("subscription_payments", "invoiceId", { type: S.UUID });
    await add("subscription_payments", "provider", { type: S.STRING(50) });
    await add("subscription_payments", "providerReference", { type: S.STRING(255) });

    const now = new Date();
    const featureDefinitions = [
      ["attendance", "Attendance", false], ["payroll", "Payroll", false], ["leave_management", "Leave management", false],
      ["advanced_reports", "Advanced reports", false], ["telegram_bot", "Telegram bot", false],
      ["sms_notifications", "SMS notifications", true], ["ai_reports", "AI reports", true],
      ["storage", "Storage", true], ["employee_limit", "Employee limit", false]
    ];
    const [existingFeatureRows] = await q.sequelize.query(
      'SELECT id, key FROM features WHERE key IN (:keys)',
      { replacements: { keys: featureDefinitions.map(([key]) => key) } }
    );
    const existingFeatureIds = new Map(existingFeatureRows.map((row) => [row.key, row.id]));
    const missingFeatures = featureDefinitions
      .filter(([key]) => !existingFeatureIds.has(key))
      .map(([key, name, isMetered]) => ({
        id: randomUUID(), key, name, isMetered, category: "subscription",
        unitName: key === "employee_limit" ? "employee" : "unit", createdAt: now, updatedAt: now
      }));
    if (missingFeatures.length) await q.bulkInsert("features", missingFeatures);
    const [featureRows] = await q.sequelize.query(
      'SELECT id, key FROM features WHERE key IN (:keys)',
      { replacements: { keys: featureDefinitions.map(([key]) => key) } }
    );
    const plans = [
      { key: "starter", name: "Starter", basePrice: 1000, includedSeats: 10, extraSeatPrice: 70, sortOrder: 1 },
      { key: "business", name: "Business", basePrice: 3000, includedSeats: 50, extraSeatPrice: 50, sortOrder: 2 },
      { key: "enterprise", name: "Enterprise", basePrice: 8000, includedSeats: 200, extraSeatPrice: 30, sortOrder: 3 }
    ];
    for (const p of plans) {
      const [rows] = await q.sequelize.query('SELECT id FROM plans WHERE key = :key', { replacements: { key: p.key } });
      const existing = rows;
      const id = existing[0]?.id || randomUUID();
      if (!existing.length) await q.bulkInsert("plans", [{ id, ...p, description: `${p.name} subscription plan`, billingCycle: "monthly", currency: "ETB", isActive: true, priceMonthly: p.basePrice, userLimit: p.includedSeats, settings: JSON.stringify({}), status: "active", createdAt: now, updatedAt: now }]);
      else await q.bulkUpdate("plans", {
        name: p.name, description: `${p.name} subscription plan`, basePrice: p.basePrice,
        billingCycle: "monthly", includedSeats: p.includedSeats, extraSeatPrice: p.extraSeatPrice,
        currency: "ETB", isActive: true, sortOrder: p.sortOrder, updatedAt: now
      }, { id });
      const enabled = p.key === "starter" ? ["attendance", "leave_management", "sms_notifications", "employee_limit"] :
        p.key === "business" ? ["attendance", "leave_management", "payroll", "advanced_reports", "telegram_bot", "sms_notifications", "ai_reports", "employee_limit"] :
        featureRows.map(f => f.key);
      const [existingPlanFeatures] = await q.sequelize.query(
        'SELECT "featureId" FROM plan_features WHERE "planId" = :planId',
        { replacements: { planId: id } }
      );
      const existingPlanFeatureIds = new Set(existingPlanFeatures.map((row) => row.featureId));
      const missingPlanFeatures = featureRows.filter((f) => !existingPlanFeatureIds.has(f.id)).map(f => ({
        id: randomUUID(), planId: id, featureId: f.id, isEnabled: enabled.includes(f.key),
        limitValue: f.key === "employee_limit" ? p.includedSeats : (f.key === "ai_reports" && p.key === "business" ? 100 : null),
        limitPeriod: f.key === "ai_reports" && p.key === "business" ? "monthly" : null, createdAt: now, updatedAt: now
      }));
      if (missingPlanFeatures.length) await q.bulkInsert("plan_features", missingPlanFeatures);
    }
  },
  async down(q) {
    await q.dropTable("usage_records");
    await q.dropTable("plan_features");
    await q.dropTable("features");
  }
};
