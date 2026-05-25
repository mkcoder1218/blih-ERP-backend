# Audit Logging Implementation

## Overview
Tracks detailed actions (`CREATE`, `UPDATE`, `DELETE`) across all primary entities, associating them with the triggering User, their IP Address, and their Tenant (`businessId`).

## 1. Model (`src/models/AuditLog.ts`)
Captures JSONB diff scopes.
```typescript
{
  id: { type: dataTypes.UUID, primaryKey: true },
  businessId: { type: dataTypes.UUID, allowNull: true },
  userId: { type: dataTypes.UUID, allowNull: true },
  action: { type: dataTypes.STRING(100), allowNull: false }, 
  entityType: { type: dataTypes.STRING(100), allowNull: false },
  entityId: { type: dataTypes.STRING(100), allowNull: false },
  beforeData: { type: dataTypes.JSONB, allowNull: true },
  afterData: { type: dataTypes.JSONB, allowNull: true },
  ipAddress: { type: dataTypes.STRING(100), allowNull: true },
  userAgent: { type: dataTypes.STRING(255), allowNull: true }
}
```

## 2. Utility Service (`src/services/auditLog.service.ts`)
A stateless helper designed to be fired asynchronously from within controllers. It silently drops errors so that a failed tracking queue does not interrupt a user's transaction.
```typescript
export class AuditLogService {
  static async log(action: string, entityType: string, entityId: string, beforeData: any = null, afterData: any = null, req?: any) {
    let businessId = req?.user?.businessId || null;
    let userId = req?.user?.id || null;
    let ipAddress = req?.ip || req?.connection?.remoteAddress || null;
    let userAgent = req?.headers?.["user-agent"] || null;

    try {
      await db.AuditLog.create({
        businessId, userId, action, entityType, entityId,
        beforeData, afterData, ipAddress, userAgent
      });
    } catch (err) {
      console.error("Failed to create audit log", err);
    }
  }
}
```

## 3. Implementation in Controllers
Every major manipulation block queries the previous DAL state and tracks the change.
*Example from `src/modules/user/user.controller.ts`:*
```typescript
  update = async (req: Request, res: Response, next: NextFunction) => {
    const beforeData = await this.service.getById(req.params.id, req.user!.businessId);
    const user = await this.service.update(req.params.id, req.user, req.body);
    
    if (!user) return next({ statusCode: 404, message: "User not found" });
    
    await AuditLogService.log("UPDATE", "user", req.params.id, beforeData, user, req);
    res.json({ user });
  };
```
