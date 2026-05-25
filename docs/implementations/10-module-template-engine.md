# Module Template Seeding Engine Implementation

## Overview
Automates the structural mapping of abstract dynamic forms (`FormSchemas`) and notification sequences (`ApprovalWorkflows`). When a new Business tenant activates an enterprise chunk (like HR, CRM, Finance), this system natively extracts default global blueprints (`ModuleTemplates`) and deplows identical `FormDefinitions` inside their isolated boundary lock!

## 1. Schema Storage Base
- **`ModuleTemplate`**: Cross-tenant global definition mapping `moduleKey` identifiers (e.g. `hr`, `crm`). Since it holds no `businessId`, it serves inherently as system configuration.
- **`ModuleTemplateForm`**: Houses literal arrays mapping specific inputs (`fields:[{label:'Date', type:'date', required: true}]`) that the form expects down into the DB mapping limits.
- **`ModuleTemplateWorkflow`**: A similar array tracking required `ApprovalStep` boundaries configuring how rigid the tree flows should behave based off the initial layout mapping.

## 2. Bootstrapping Global Rules (`database/seed.ts`)
Attached to the bottom wrapper of `seedDefaults()`, the new constructor dynamically loads generic baseline arrays straight into the models preventing repetitive configurations on platform startups:
```typescript
const defaultTemplates = [
  {
    moduleKey: 'hr', name: 'HR Core',
    forms: [
      { formKey: 'leave_req', formName: 'Leave Request', fields: [{label: 'Reason', key: 'reason', type: 'text', required: true}] }
    ]
  }
];
// Automatically pushed onto db.ModuleTemplate
```

## 3. Dynamic Application (`TemplateService.applyTemplate`)
The engine iterates via `applyTemplate` iterating specifically to protect from destructive overlaps, utilizing the boolean parameter `reapply`:
```typescript
const existing = await db.FormDefinition.findOne({ where: { businessId, key: f.formKey, moduleKey } });
if (existing && !reapply) continue; // Safely guards mapping destruction natively!
```
- If it encounters a fresh mapping map, it automatically spins `FormDefinition`, injects `businessId`, iterates `defaultFields` internally creating `FormField` elements seamlessly matching their template array exactly!

## 4. Hook Auto-Propagation (`business.service.ts`)
During core `create()` inside your tenant setup:
```typescript
// Iterates explicitly on Plan hooks
for (const pm of planModules) {
  await db.BusinessModule.create({...});
  
  try {
     // Natively auto-syncs without manual configuration
     await this.templateService.applyTemplate(business.id, pm.moduleKey, false);
  } catch(err) { }
}
```

## 5. Exposing Endpoints (`POST /api/module-templates/apply`)
Accessible under `/api/module-templates/`. Only users passing `requireRole('BUSINESS_ADMIN')` checks can access them. 
A `PlatformSuperAdmin` can manually force a specific explicit `targetBusinessId` payload map via `req.body`, automatically coercing the update explicitly to external tenants directly. It perfectly wraps within `AuditLogService` for traceability mirroring everything directly.
