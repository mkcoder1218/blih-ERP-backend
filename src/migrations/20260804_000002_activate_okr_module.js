"use strict";

const { randomUUID } = require("crypto");

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "businesses")) || !(await tableExists(queryInterface, "business_modules"))) {
      return;
    }

    // 1. Activate OKR module for all businesses
    const [businesses] = await queryInterface.sequelize.query(`
      SELECT b.id
      FROM businesses b
      WHERE NOT EXISTS (
        SELECT 1
        FROM business_modules bm
        WHERE bm."businessId" = b.id
          AND bm."moduleKey" = 'okr'
      );
    `);

    const now = new Date();
    if (businesses.length) {
      await queryInterface.bulkInsert("business_modules", businesses.map((business) => ({
        id: randomUUID(),
        businessId: business.id,
        moduleKey: "okr",
        moduleName: "Objectives & Key Results",
        status: "active",
        settings: JSON.stringify({}),
        enabledAt: now,
        createdAt: now,
        updatedAt: now
      })));
    }

    await queryInterface.sequelize.query(`
      UPDATE business_modules
      SET "status" = 'active',
          "moduleName" = COALESCE(NULLIF("moduleName", ''), 'Objectives & Key Results'),
          "enabledAt" = COALESCE("enabledAt", NOW()),
          "disabledAt" = NULL,
          "updatedAt" = NOW()
      WHERE "moduleKey" = 'okr'
        AND "status" <> 'active';
    `);

    // 2. Ensure performance permissions are seeded and linked to roles
    if (await tableExists(queryInterface, "permissions") && await tableExists(queryInterface, "roles") && await tableExists(queryInterface, "role_permissions")) {
      // Create permissions if they do not exist
      const performancePerms = [
        { id: randomUUID(), key: "performance.read", module: "performance", action: "read", description: "View performance metrics, KPIs, and review cycles", createdAt: now, updatedAt: now },
        { id: randomUUID(), key: "performance.manage", module: "performance", action: "manage", description: "Conduct appraisals, set OKRs, manage discipline", createdAt: now, updatedAt: now },
        { id: randomUUID(), key: "performance.self", module: "performance", action: "self", description: "View own performance reviews, set personal OKRs, fill in evaluation forms", createdAt: now, updatedAt: now }
      ];

      for (const perm of performancePerms) {
        const [existing] = await queryInterface.sequelize.query(`
          SELECT id FROM permissions WHERE key = '${perm.key}';
        `);
        if (!existing.length) {
          await queryInterface.bulkInsert("permissions", [perm]);
        }
      }

      // Query ids of the created/existing permissions
      const [dbPerms] = await queryInterface.sequelize.query(`
        SELECT id, key FROM permissions WHERE key IN ('performance.read', 'performance.manage', 'performance.self');
      `);

      const readPermId = dbPerms.find(p => p.key === "performance.read")?.id;
      const managePermId = dbPerms.find(p => p.key === "performance.manage")?.id;
      const selfPermId = dbPerms.find(p => p.key === "performance.self")?.id;

      // Link to roles
      const [roles] = await queryInterface.sequelize.query(`
        SELECT id, key FROM roles;
      `);

      const rolePermissionLinks = [];

      for (const role of roles) {
        // Platform Super Admin, Business Admin, HR Manager, Dept Head, Project Manager get read, manage, self
        if (["PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN", "HR_MANAGER", "DEPARTMENT_HEAD", "PROJECT_MANAGER"].includes(role.key)) {
          if (readPermId) rolePermissionLinks.push({ roleId: role.id, permissionId: readPermId });
          if (managePermId) rolePermissionLinks.push({ roleId: role.id, permissionId: managePermId });
          if (selfPermId) rolePermissionLinks.push({ roleId: role.id, permissionId: selfPermId });
        }
        // Employee gets self
        if (role.key === "EMPLOYEE") {
          if (selfPermId) rolePermissionLinks.push({ roleId: role.id, permissionId: selfPermId });
        }
      }

      for (const link of rolePermissionLinks) {
        const [existingLink] = await queryInterface.sequelize.query(`
          SELECT 1 FROM role_permissions WHERE "roleId" = '${link.roleId}' AND "permissionId" = '${link.permissionId}';
        `);
        if (!existingLink.length) {
          await queryInterface.bulkInsert("role_permissions", [{
            id: randomUUID(),
            roleId: link.roleId,
            permissionId: link.permissionId,
            createdAt: now,
            updatedAt: now
          }]);
        }
      }
    }
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, "business_modules"))) {
      return;
    }

    await queryInterface.sequelize.query(`
      UPDATE business_modules
      SET "status" = 'inactive',
          "disabledAt" = NOW(),
          "updatedAt" = NOW()
      WHERE "moduleKey" = 'okr'
        AND "moduleName" = 'Objectives & Key Results';
    `);
  }
};
