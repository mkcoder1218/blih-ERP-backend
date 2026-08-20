import type { Request, Response } from "express";
import { db } from "../../models";
import { isProtectedRoleKey } from "../../models/Role";
import { ok } from "../../utils/apiResponse";
import { buildPermissionMetadata, expandPermissionDependencies } from "./permission.metadata";
import { SYSTEM_PERMISSIONS } from "./seed/permissions.seed";

const BRAIN_CONTACT_PERMISSION_PREFIX = "brain.contacts.";

export class PermissionController {
  list = async (_req: Request, res: Response) => {
    const rows = await db.Permission.findAll({
      order: [["module", "ASC"], ["action", "ASC"]]
    });
    const allKeys = new Set<string>(rows.map((permission: any) => String(permission.key)));
    const permissions = rows
      .map((permission: any) => {
        const plain = permission.toJSON ? permission.toJSON() : permission;
        return {
          ...plain,
          ...buildPermissionMetadata(plain, allKeys),
        };
      })
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));

    return ok(res, { permissions, count: permissions.length }, "Permissions list");
  };

  seed = async (_req: Request, res: Response) => {
    for (const p of SYSTEM_PERMISSIONS) {
      const existing = await db.Permission.findOne({ where: { key: p.key } });
      if (existing) {
        await existing.update({
          module: p.module,
          action: p.action,
          description: p.description ?? existing.description,
        });
      } else {
        await db.Permission.create(p);
      }
    }

    const brainAccessPermission = await db.Permission.findOne({
      where: { key: "brain.access" },
      attributes: ["id"]
    });

    const contactPermissionKeys = SYSTEM_PERMISSIONS
      .filter((permission) => permission.key.startsWith(BRAIN_CONTACT_PERMISSION_PREFIX))
      .map((permission) => permission.key);

    let syncedRoleCount = 0;

    if (brainAccessPermission && contactPermissionKeys.length > 0) {
      const contactPermissions = await db.Permission.findAll({
        where: { key: contactPermissionKeys },
        attributes: ["id", "key"]
      });

      const brainRoleLinks = await db.RolePermission.findAll({
        where: { permissionId: brainAccessPermission.id },
        attributes: ["roleId"]
      });

      const roleIds = Array.from(
        new Set(brainRoleLinks.map((link: any) => String(link.roleId)))
      );

      for (const roleId of roleIds) {
        for (const permission of contactPermissions) {
          await db.RolePermission.findOrCreate({
            where: {
              roleId,
              permissionId: permission.id
            },
            defaults: {
              roleId,
              permissionId: permission.id
            }
          });
        }
      }

      syncedRoleCount = roleIds.length;
    }

    return ok(
      res,
      {
        seededPermissionCount: SYSTEM_PERMISSIONS.length,
        syncedBrainRoleCount: syncedRoleCount,
        brainContactPermissionCount: contactPermissionKeys.length
      },
      "Permissions seeded successfully"
    );
  };

  assignToRole = async (req: Request, res: Response) => {
    const { roleId, permissionKeys } = req.body as { roleId: string; permissionKeys: string[] };
    const role = await db.Role.findByPk(roleId);
    if (!role) return res.status(404).json({ message: "Role not found" });

    const isProtectedSystemRole = role.isSystemRole || isProtectedRoleKey(role.key);
    if (isProtectedSystemRole && !req.user!.isPlatformSuperAdmin) {
      return res.status(403).json({
        message: "System role permissions can only be edited by a platform super admin"
      });
    }

    if (!req.user!.isPlatformSuperAdmin && role.businessId !== req.user!.businessId) {
      return res.status(403).json({ message: "Forbidden: You cannot manage roles of other businesses" });
    }

    const allPermissions = await db.Permission.findAll({
      attributes: ["id", "key", "module", "action", "description"]
    });
    const expandedKeys = expandPermissionDependencies(
      Array.isArray(permissionKeys) ? permissionKeys : [],
      allPermissions.map((permission: any) => permission.toJSON ? permission.toJSON() : permission),
    );
    const perms = allPermissions.filter((permission: any) => expandedKeys.includes(permission.key));

    await role.setPermissions(perms);
    return ok(res, { permissionKeys: expandedKeys }, "Permissions assigned to role");
  };
}
