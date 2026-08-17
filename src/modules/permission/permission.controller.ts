import type { Request, Response } from "express";
import { db } from "../../models";
import { ok } from "../../utils/apiResponse";
import { SYSTEM_PERMISSIONS } from "./seed/permissions.seed";

const BRAIN_CONTACT_PERMISSION_PREFIX = "brain.contacts.";

export class PermissionController {
  list = async (req: Request, res: Response) => {
    const permissions = await db.Permission.findAll({
      order: [["module", "ASC"], ["action", "ASC"]]
    });
    return ok(res, { permissions, count: permissions.length }, "Permissions list");
  };

  seed = async (req: Request, res: Response) => {
    for (const p of SYSTEM_PERMISSIONS) {
      await db.Permission.findOrCreate({
        where: { key: p.key },
        defaults: p
      });
    }

    // Contacts belong to Brain. Any role that already has brain.access should
    // automatically receive the contact permissions when defaults are seeded.
    // This also covers custom roles instead of hard-coding system role names.
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
    const { roleId, permissionKeys } = req.body;
    const role = await db.Role.findByPk(roleId);
    if (!role) return res.status(404).json({ message: "Role not found" });

    // Tenant isolation check
    if (!req.user!.isPlatformSuperAdmin && role.businessId !== req.user!.businessId) {
      return res.status(403).json({ message: "Forbidden: You cannot manage roles of other businesses" });
    }

    const perms = await db.Permission.findAll({
      where: { key: permissionKeys }
    });

    await role.setPermissions(perms);
    return ok(res, null, "Permissions assigned to role");
  };
}
