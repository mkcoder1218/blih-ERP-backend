# Dashboard & Activity Feed Engine Implementation

## Overview
A dynamic, customizable landing space foundation and cross-module chronological tracker block designed explicitly to isolate abstract dashboard grids (`DashboardWidget`) and table filters (`SavedView`) cleanly across `businessId` boundaries.

## 1. Schema Fundamentals
- **`DashboardWidget`**: Dictates front-end UI boundaries explicitly tracking properties like `widgetType` (e.g. `chart`, `list`, `count`) alongside explicit `position` vectors.
- **`SavedView`**: Memorizes grid interactions (custom filters, column views) storing arrays directly inside JSON schemas so Business Admins can generate templates out of the box that persist universally inside a company namespace.
- **`ActivityLog`**: A flat timeline tracker distinct from `AuditLog` specifically optimized for client-facing queries. 

## 2. Activity Feed Loop Hook
Rather than manually repeating code mapping every single backend model interaction into the `ActivityLogger`, we hooked it directly into the master `AuditLogService`.

Wait! We already passed everything via `AuditLogService.log('ACTION', ...)` in previous tickets (Approvals, Users, Roles, Departments, Forms). Because we injected `ActivityLogger.log()` directly at the exit threshold of `AuditLogService`, *every core modification* performed across the entire ERP will natively mirror a user-facing event securely without additional configuration blocks!

```typescript
    // Auto-dispatch public-facing activity log directly within AuditLog logic
    try {
      if (businessId) {
        await ActivityLogger.log({
          businessId,
          userId: userId || undefined,
          moduleKey: entityType, 
          action,
          entityType,
          entityId,
          title: \`\${action} on \${entityType}\`,
          description: \`System recorded \${action} automatically.\`
        });
      }
    } catch(err) { }
```

## 3. Scope Checks & Endpoints
The platform utilizes standard query intercepts for `/api/activity-logs`.
- Business queries automatically default to standard offset pagination rules (`page, size`).
- Search vectors support mapping by `moduleKey`, `entityType`, or literal date bounds.  
- Routing locks are in effect mapping `req.user.businessId` enforcing strict horizontal isolation limits across Dashboards.

### Accessible Core Routes:
- `GET /api/activity-logs/` -> Retrieves chronological logs (adjoining with strict query locks unless the invoker identifies via `PlatformSuperAdmin`).
- `CRUD /api/dashboard-widgets/` -> Constructs user-defined block mappings.
- `CRUD /api/saved-views/` -> Maps grid definitions globally per user logic natively tracking abstract configuration maps.
