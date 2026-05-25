import { db } from "../models";
import { TemplateService } from "../modules/moduleTemplate/template.service";

export const SYSTEM_ROLES = {
  PLATFORM_SUPER_ADMIN: { name: "Platform Super Admin", key: "PLATFORM_SUPER_ADMIN" },
  BUSINESS_ADMIN: { name: "Business Admin", key: "BUSINESS_ADMIN" },
  FINANCE_MANAGER: { name: "Finance Manager", key: "FINANCE_MANAGER" },
  DEPARTMENT_HEAD: { name: "Department Head", key: "DEPARTMENT_HEAD" },
  PROJECT_MANAGER: { name: "Project Manager", key: "PROJECT_MANAGER" }
} as const;

export const BASE_PERMISSIONS = [
  { module: "business", action: "create", key: "business.create", description: "Create business" },
  { module: "business", action: "read", key: "business.read", description: "Read business" },
  { module: "business", action: "update", key: "business.update", description: "Update business" },
  { module: "business", action: "delete", key: "business.delete", description: "Delete business" },

  { module: "user", action: "create", key: "user.create", description: "Create user" },
  { module: "user", action: "read", key: "user.read", description: "Read user" },
  { module: "user", action: "update", key: "user.update", description: "Update user" },
  { module: "user", action: "delete", key: "user.delete", description: "Delete user" },

  { module: "role", action: "create", key: "role.create", description: "Create role" },
  { module: "role", action: "read", key: "role.read", description: "Read role" },
  { module: "role", action: "update", key: "role.update", description: "Update role" },
  { module: "role", action: "delete", key: "role.delete", description: "Delete role" }
];

export const DEFAULT_PLANS = [
  { key: "free", name: "Free", priceMonthly: 0, userLimit: 5, modules: ["hr", "projects"] },
  { key: "starter", name: "Starter", priceMonthly: 49, userLimit: 20, modules: ["hr", "crm", "projects"] },
  { key: "growth", name: "Growth", priceMonthly: 99, userLimit: 50, modules: ["hr", "crm", "projects", "finance"] },
  { key: "enterprise", name: "Enterprise", priceMonthly: 299, userLimit: null, modules: ["hr", "crm", "projects", "finance", "brain", "okr"] }
];

export async function seedDefaults() {
  const permissions: any[] = [];
  for (const perm of BASE_PERMISSIONS) {
    const [p] = await db.Permission.findOrCreate({ where: { key: perm.key }, defaults: perm });
    permissions.push(p);
  }

  const [platformRole] = await db.Role.findOrCreate({
    where: { businessId: null, key: SYSTEM_ROLES.PLATFORM_SUPER_ADMIN.key },
    defaults: { ...SYSTEM_ROLES.PLATFORM_SUPER_ADMIN, businessId: null, isSystemRole: true }
  });

  const [businessAdminRole] = await db.Role.findOrCreate({
    where: { businessId: null, key: SYSTEM_ROLES.BUSINESS_ADMIN.key },
    defaults: { ...SYSTEM_ROLES.BUSINESS_ADMIN, businessId: null, isSystemRole: true }
  });

  const [financeManagerRole] = await db.Role.findOrCreate({
    where: { businessId: null, key: SYSTEM_ROLES.FINANCE_MANAGER.key },
    defaults: { ...SYSTEM_ROLES.FINANCE_MANAGER, businessId: null, isSystemRole: true }
  });

  const [departmentHeadRole] = await db.Role.findOrCreate({
    where: { businessId: null, key: SYSTEM_ROLES.DEPARTMENT_HEAD.key },
    defaults: { ...SYSTEM_ROLES.DEPARTMENT_HEAD, businessId: null, isSystemRole: true }
  });

  const [projectManagerRole] = await db.Role.findOrCreate({
    where: { businessId: null, key: SYSTEM_ROLES.PROJECT_MANAGER.key },
    defaults: { ...SYSTEM_ROLES.PROJECT_MANAGER, businessId: null, isSystemRole: true }
  });

  await platformRole.setPermissions(permissions);

  const businessAdminPerms = permissions.filter((p: any) => !["business.create", "business.delete"].includes(p.key));
  await businessAdminRole.setPermissions(businessAdminPerms);

  // Finance/Dept/Project roles start with the same base permissions as Business Admin for now.
  // Fine-grained permission keys can be added later without changing role keys.
  await financeManagerRole.setPermissions(businessAdminPerms);
  await departmentHeadRole.setPermissions(businessAdminPerms);
  await projectManagerRole.setPermissions(businessAdminPerms);

  for (const p of DEFAULT_PLANS) {
    const [plan] = await db.Plan.findOrCreate({
      where: { key: p.key },
      defaults: {
        name: p.name,
        key: p.key,
        priceMonthly: p.priceMonthly,
        userLimit: p.userLimit,
        status: "active"
      }
    });

    for (const modKey of p.modules) {
      await db.PlanModule.findOrCreate({
        where: { planId: plan.id, moduleKey: modKey },
        defaults: {
          planId: plan.id,
          moduleKey: modKey,
          moduleName: modKey.toUpperCase(),
          isEnabled: true
        }
      });
    }
  }

  // Pre-seed core template maps (HR, CRM, etc.)
  const tplSvc = new TemplateService();
  await tplSvc.seedGlobalTemplates();
}
