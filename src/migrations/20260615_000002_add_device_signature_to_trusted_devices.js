"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function columnExists(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  return Boolean(table[columnName]);
}

async function addIndexSafe(queryInterface, tableName, fields, name, options = {}) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((idx) => idx.name === name)) await queryInterface.addIndex(tableName, fields, { ...options, name });
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "trusted_devices"))) return;
    if (!(await columnExists(queryInterface, "trusted_devices", "deviceSignature"))) {
      await queryInterface.addColumn("trusted_devices", "deviceSignature", { type: Sequelize.STRING(255), allowNull: true });
    }
    await addIndexSafe(queryInterface, "trusted_devices", ["businessId", "userId", "deviceSignature"], "idx_trusted_devices_business_user_signature");
  },

  async down(queryInterface) {
    if ((await tableExists(queryInterface, "trusted_devices")) && (await columnExists(queryInterface, "trusted_devices", "deviceSignature"))) {
      await queryInterface.removeColumn("trusted_devices", "deviceSignature");
    }
  },
};
