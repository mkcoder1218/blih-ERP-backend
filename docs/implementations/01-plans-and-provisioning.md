# Plans & Provisioning Implementation

## Overview
This feature introduces SaaS pricing tiers (`Plans`) and links them to permitted modular features (`PlanModules`). It integrates right into the `Business` onboarding process.

## 1. Models
### `src/models/Plan.ts`
Holds the core tiers (Free, Starter, Growth, Enterprise).
```typescript
{
  id: { type: dataTypes.UUID, primaryKey: true },
  name: { type: dataTypes.STRING(120), allowNull: false },
  key: { type: dataTypes.STRING(50), allowNull: false, unique: true },
  priceMonthly: { type: dataTypes.DECIMAL(10, 2) },
  userLimit: { type: dataTypes.INTEGER, allowNull: true },
  settings: { type: dataTypes.JSONB, defaultValue: {} },
  status: { type: dataTypes.STRING(50), defaultValue: "active" }
}
```

### `src/models/PlanModule.ts`
Records what modules are unlocked by default for a specific `Plan`.
```typescript
{
  planId: { type: dataTypes.UUID, allowNull: false },
  moduleKey: { type: dataTypes.STRING(120), allowNull: false },
  moduleName: { type: dataTypes.STRING(120), allowNull: false },
  isEnabled: { type: dataTypes.BOOLEAN, defaultValue: false }
}
```

## 2. Default Seeding (`src/database/seed.ts`)
During database init, we load the default SaaS plan parameters:
```typescript
export const DEFAULT_PLANS = [
  { key: "free", name: "Free", priceMonthly: 0, userLimit: 5, modules: ["hr", "projects"] },
  { key: "starter", name: "Starter", priceMonthly: 49, userLimit: 20, modules: ["hr", "crm", "projects"] },
  { key: "growth", name: "Growth", priceMonthly: 99, userLimit: 50, modules: ["hr", "crm", "projects", "finance"] },
  { key: "enterprise", name: "Enterprise", priceMonthly: 299, userLimit: null, modules: ["hr", "crm", "projects", "finance", "brain", "okr"] }
];
```

## 3. Provisioning Logic (`src/modules/business/business.service.ts`)
When a business is created, the system auto-resolves the `free` tier fallback and duplicates the allowed keys out of `PlanModule` straight into the tenant's `BusinessModule`:
```typescript
if (!payload.planId) {
  const freePlan = await db.Plan.findOne({ where: { key: "free" } });
  if (freePlan) payload.planId = freePlan.id;
}
const business = await this.dal.create(payload);

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
  }
}
```
