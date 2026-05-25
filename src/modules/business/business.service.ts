import { BusinessDAL } from "./business.dal";
import { slugify } from "../../utils/slugify";
import { TemplateService } from "../moduleTemplate/template.service";

export class BusinessService {
  private templateService = new TemplateService();
  private dal: BusinessDAL;

  constructor() {
    this.dal = new BusinessDAL();
  }

  async create(data: any) {
    const { db } = require("../../models");
    const payload: any = { ...data };
    if (!payload.slug && payload.name) payload.slug = slugify(payload.name);

    const business = await this.dal.create(payload);

    // Default business settings (minimal baseline; can be expanded later)
    await db.BusinessSetting.findOrCreate({
      where: { businessId: business.id },
      defaults: { businessId: business.id, key: "general", value: { locale: "en", timezone: "UTC" } }
    });

    // Create default roles scoped to this business, copying permissions from global system roles (businessId = null).
    const roleKeys = [
      "BUSINESS_ADMIN",
      "HR_MANAGER",
      "FINANCE_MANAGER",
      "CRM_MANAGER",
      "PROJECT_MANAGER",
      "DEPARTMENT_HEAD",
      "EMPLOYEE",
      "CLIENT"
    ];

    for (const key of roleKeys) {
      const globalRole = await db.Role.findOne({ where: { businessId: null, key } });
      const [role] = await db.Role.findOrCreate({
        where: { businessId: business.id, key },
        defaults: { businessId: business.id, key, name: key.replace(/_/g, " "), description: null, isSystemRole: false }
      });
      if (globalRole) {
        const perms = await globalRole.getPermissions();
        await role.setPermissions(perms);
      }
    }

    if (business.planId) {
      const planModules = await db.PlanModule.findAll({ where: { planId: business.planId, isEnabled: true } });
      for (const pm of planModules) {
        await db.BusinessModule.create({
          businessId: business.id,
          moduleKey: pm.moduleKey,
          moduleName: pm.moduleName,
          status: "active",
          enabledAt: new Date()
        });

        try {
          // Provision defaults based on module enablement
          await this.templateService.applyTemplate(business.id, pm.moduleKey, false);
        } catch(err) {
          console.warn(`Failed to auto-apply template for ${pm.moduleKey} on business setup:`, err);
        }
      }
    }
    return business;
  }

  listAll() {
    return this.dal.findAll({}, { order: [["createdAt", "DESC"]] });
  }

  getById(id: string) {
    return this.dal.findById(id);
  }

  update(id: string, data: any) {
    const payload = { ...data };
    if (payload.name && !payload.slug) payload.slug = slugify(payload.name);
    return this.dal.update(id, payload);
  }

  softDelete(id: string) {
    return this.dal.softDelete(id);
  }
}
