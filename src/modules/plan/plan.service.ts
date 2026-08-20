import { Op } from "sequelize";
import { db } from "../../models";
import { SubscriptionService } from "../subscription/subscription.service";

const planIncludes = () => [
  { model: db.PlanModule, as: "modules", required: false },
  { model: db.PlanFeature, as: "features", required: false, include: [{ model: db.Feature, as: "feature" }] },
  { model: db.SubscriptionPolicy, as: "subscriptionPolicy", required: false },
];

export class PlanService {
  private subscriptionService = new SubscriptionService();

  list() {
    return db.Plan.findAll({
      include: planIncludes(),
      order: [["sortOrder", "ASC"], ["name", "ASC"]],
      distinct: true,
    });
  }

  getById(id: string) {
    return db.Plan.findByPk(id, { include: planIncludes() });
  }

  async catalog() {
    const [planModules, businessModules, features] = await Promise.all([
      db.PlanModule.findAll({ attributes: ["moduleKey", "moduleName"], order: [["moduleName", "ASC"]] }),
      db.BusinessModule.findAll({ attributes: ["moduleKey", "moduleName"], order: [["moduleName", "ASC"]] }),
      db.Feature.findAll({ order: [["category", "ASC"], ["name", "ASC"]] }),
    ]);

    const byKey = new Map<string, { moduleKey: string; moduleName: string }>();
    for (const row of [...planModules, ...businessModules]) {
      const plain = row.toJSON ? row.toJSON() : row;
      if (!plain.moduleKey) continue;
      if (!byKey.has(plain.moduleKey)) {
        byKey.set(plain.moduleKey, { moduleKey: plain.moduleKey, moduleName: plain.moduleName || plain.moduleKey });
      }
    }

    return {
      modules: [...byKey.values()].sort((a, b) => a.moduleName.localeCompare(b.moduleName)),
      features,
    };
  }

  async create(data: any) {
    const { modules = [], features = [], policy = null, ...planData } = data;
    const normalized = this.normalizePlanData(planData);
    const transaction = await db.sequelize.transaction();
    try {
      const plan = await db.Plan.create(normalized, { transaction });
      await this.replaceEntitlements(plan.id, modules, features, transaction);
      if (policy) await this.upsertPolicy(plan.id, policy, transaction);
      await transaction.commit();
      return this.getById(plan.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async update(id: string, data: any) {
    const existing = await db.Plan.findByPk(id);
    if (!existing) return null;

    const hasModules = Object.prototype.hasOwnProperty.call(data, "modules");
    const hasFeatures = Object.prototype.hasOwnProperty.call(data, "features");
    const hasPolicy = Object.prototype.hasOwnProperty.call(data, "policy");
    const { modules, features, policy, ...planData } = data;

    const transaction = await db.sequelize.transaction();
    try {
      if (Object.keys(planData).length) await existing.update(this.normalizePlanData(planData), { transaction });
      if (hasModules) await this.replaceModules(id, modules || [], transaction);
      if (hasFeatures) await this.replaceFeatures(id, features || [], transaction);
      if (hasPolicy) await this.upsertPolicy(id, policy || {}, transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    // A plan definition is a commercial entitlement template. Keep all businesses
    // currently subscribed to it synchronized with the new module configuration.
    const subscriptions = await db.Subscription.findAll({ where: { planId: id }, attributes: ["businessId"] });
    for (const subscription of subscriptions) {
      await this.subscriptionService.syncBusinessEntitlements(subscription.businessId, id);
    }

    return this.getById(id);
  }

  async remove(id: string) {
    const plan = await db.Plan.findByPk(id);
    if (!plan) return null;
    const inUse = await db.Subscription.count({
      where: { planId: id, status: { [Op.notIn]: ["canceled", "expired"] } },
    });
    if (inUse > 0) throw new Error("This plan is assigned to active subscriptions. Deactivate it instead of deleting it.");
    await plan.destroy();
    return true;
  }

  private normalizePlanData(data: any) {
    const next = { ...data };
    if (next.priceMonthly != null && next.basePrice == null) next.basePrice = next.priceMonthly;
    if (next.basePrice != null && next.priceMonthly == null) next.priceMonthly = next.basePrice;
    if (next.isActive != null && next.status == null) next.status = next.isActive ? "active" : "inactive";
    if (next.status != null && next.isActive == null) next.isActive = next.status === "active";
    if (next.currency) next.currency = String(next.currency).toUpperCase();
    return next;
  }

  private async replaceEntitlements(planId: string, modules: any[], features: any[], transaction: any) {
    await this.replaceModules(planId, modules, transaction);
    await this.replaceFeatures(planId, features, transaction);
  }

  private async replaceModules(planId: string, modules: any[], transaction: any) {
    await db.PlanModule.destroy({ where: { planId }, transaction });
    if (!modules.length) return;
    await db.PlanModule.bulkCreate(
      modules.map((module: any) => ({
        planId,
        moduleKey: module.moduleKey,
        moduleName: module.moduleName || module.moduleKey,
        isEnabled: Boolean(module.isEnabled),
      })),
      { transaction },
    );
  }

  private async replaceFeatures(planId: string, features: any[], transaction: any) {
    await db.PlanFeature.destroy({ where: { planId }, transaction });
    if (!features.length) return;
    await db.PlanFeature.bulkCreate(
      features.map((feature: any) => ({
        planId,
        featureId: feature.featureId,
        isEnabled: Boolean(feature.isEnabled),
        limitValue: feature.limitValue ?? null,
        limitPeriod: feature.limitPeriod ?? null,
        overageUnitPrice: feature.overageUnitPrice ?? 0,
      })),
      { transaction },
    );
  }

  private async upsertPolicy(planId: string, policy: any, transaction: any) {
    const scopeKey = `plan:${planId}`;
    const [row] = await db.SubscriptionPolicy.findOrCreate({
      where: { scopeKey },
      defaults: { scopeKey, scopeType: "plan", planId, businessId: null },
      transaction,
    });
    await row.update({ ...policy, scopeKey, scopeType: "plan", planId, businessId: null }, { transaction });
  }
}
