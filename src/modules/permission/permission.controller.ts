import type { Request, Response } from "express";
import { db } from "../../models";
import { ok } from "../../utils/apiResponse";
import { SYSTEM_PERMISSIONS } from "./seed/permissions.seed";

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

    return ok(res, null, "Permissions seeded successfully");
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
