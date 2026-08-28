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
  async up(queryInterface) {
    if (!(await tableExists(queryInterface, "permissions"))) {
      return;
    }

    const now = new Date();

    const [existingPermissions] = await queryInterface.sequelize.query(`
      SELECT id
      FROM permissions
      WHERE key = 'job.request'
      LIMIT 1;
    `);

    let permissionId = existingPermissions[0]?.id;

    if (!permissionId) {
      permissionId = randomUUID();
      await queryInterface.bulkInsert("permissions", [
        {
          id: permissionId,
          module: "job",
          action: "request",
          key: "job.request",
          description: "Submit a new hiring request for approval",
          createdAt: now,
          updatedAt: now,
        },
      ]);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE permissions
        SET module = 'job',
            action = 'request',
            description = 'Submit a new hiring request for approval',
            "updatedAt" = NOW()
        WHERE id = :permissionId;
      `, {
        replacements: { permissionId },
      });
    }

    if (
      !(await tableExists(queryInterface, "roles")) ||
      !(await tableExists(queryInterface, "role_permissions"))
    ) {
      return;
    }

    const [departmentHeadRoles] = await queryInterface.sequelize.query(`
      SELECT id
      FROM roles
      WHERE "deletedAt" IS NULL
        AND (
          UPPER(COALESCE(key, '')) IN ('DEPARTMENT_HEAD', 'DEPT_HEAD')
          OR regexp_replace(
            UPPER(TRIM(COALESCE(name, ''))),
            '[^A-Z0-9]+',
            '_',
            'g'
          ) IN ('DEPARTMENT_HEAD', 'DEPT_HEAD')
        );
    `);

    for (const role of departmentHeadRoles) {
      const [existingLinks] = await queryInterface.sequelize.query(`
        SELECT 1
        FROM role_permissions
        WHERE "roleId" = :roleId
          AND "permissionId" = :permissionId
        LIMIT 1;
      `, {
        replacements: {
          roleId: role.id,
          permissionId,
        },
      });

      if (!existingLinks.length) {
        await queryInterface.bulkInsert("role_permissions", [
          {
            id: randomUUID(),
            roleId: role.id,
            permissionId,
            createdAt: now,
            updatedAt: now,
          },
        ]);
      }
    }
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, "permissions"))) {
      return;
    }

    const [permissions] = await queryInterface.sequelize.query(`
      SELECT id
      FROM permissions
      WHERE key = 'job.request'
      LIMIT 1;
    `);

    const permissionId = permissions[0]?.id;
    if (!permissionId) return;

    if (await tableExists(queryInterface, "role_permissions")) {
      await queryInterface.sequelize.query(`
        DELETE FROM role_permissions
        WHERE "permissionId" = :permissionId;
      `, {
        replacements: { permissionId },
      });
    }

    await queryInterface.sequelize.query(`
      DELETE FROM permissions
      WHERE id = :permissionId;
    `, {
      replacements: { permissionId },
    });
  },
};
