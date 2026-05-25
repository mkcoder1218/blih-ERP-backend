# Business Modules Control Implementation

## Overview
Business Modules decouple the global `Plan` limits from the actual live usage inside a tenant. While a `Plan` authorizes what a tenant *can* do, the `BusinessModule` toggles track what features are actively turned on inside their ERP.

## 1. Model (`src/models/BusinessModule.ts`)
```typescript
{
  id: { type: dataTypes.UUID, primaryKey: true },
  businessId: { type: dataTypes.UUID, allowNull: false },
  moduleKey: { type: dataTypes.STRING(120), allowNull: false },
  moduleName: { type: dataTypes.STRING(120), allowNull: false },
  status: { type: dataTypes.STRING(50), defaultValue: "active" }, // active/inactive
  settings: { type: dataTypes.JSONB, defaultValue: {} },
  enabledAt: { type: dataTypes.DATE, allowNull: true },
  disabledAt: { type: dataTypes.DATE, allowNull: true }
}
```

## 2. Guard Middleware (`src/middlewares/module.ts`)
This middleware checks whether the tenant currently has a feature mapped and toggled to `"active"` before authorizing routes (e.g. hitting HR endpoints):
```typescript
export const requireActiveModule = (moduleKey: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user?.businessId;
      if (!businessId) return next({ statusCode: 401, message: "Unauthorized" });

      const businessModule = await db.BusinessModule.findOne({
        where: { businessId, moduleKey, status: "active" }
      });

      if (!businessModule) {
        return next({ statusCode: 403, message: \`Module '\${moduleKey}' is not active.\` });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
```

## 3. Permissions & Routes
Located in `src/modules/businessModule/businessModule.routes.ts`:
- **Read-Only**: `BUSINESS_ADMIN` can read the `BusinessModule` rows associated with their tenant ID to generate navigation panels. 
- **Mutation**: Only `PLATFORM_SUPER_ADMIN` can trigger a `PATCH` request to manipulate `.status` fields (locking users out of apps if payments bounce, etc).
