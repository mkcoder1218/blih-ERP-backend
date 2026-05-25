# Organization Setup Module Implementation

## Overview
This implementation provides the foundational HR/ERP structural elements for a business. It introduces `Department`, `Position`, and `BusinessUserProfile`, ensuring deep tenant isolation and granular access across the organization tree.

## 1. Relational Models
Located in `src/models/`, the mapping is established:
- **`Department.ts`**: Supports nested hierarchies via a self-referencing `parentDepartmentId` association. It `belongsTo` a Business.
- **`Position.ts`**: Directly scoped to both a `Business` and a `Department`, holding `level`, `title`, and `key` for strict job classification logic.
- **`BusinessUserProfile.ts`**: The core pivot bridging an authentication `User` row to their concrete ERP context (`Department`, `Position`, employment configurations like `employeeCode`, `joinedAt`, etc).

## 2. Dynamic Pagination & Searching
Implemented within each domain's service and DAL layer. Example from `department.service.ts`:
```typescript
list(businessId: string, search: string, page: number, size: number) {
  const offset = (page - 1) * size;
  const query: any = { businessId };
  if (search) query.name = { [Op.iLike]: \`%\${search}%\` };
  return this.dal.findAll(query, offset, size);
}
```

## 3. Strict Tenant Isolation
All lists, queries, and mutations strictly scope down to the authenticated profile's boundary:
```typescript
private deriveBusinessId(req: Request) {
  return req.user!.isPlatformSuperAdmin && req.query.businessId
    ? req.query.businessId as string
    : req.user!.businessId; // Locks business admins and normal employees to their tenant.
}
```

## 4. Permission Boundary Architecture 
- **Platform Super Admin**: Enjoys universal visibility/mutation via query parameters by explicitly overriding `deriveBusinessId`.
- **Business Admin**: Limited strictly to managing their own respective ERP branch via the standard `requireRole('BUSINESS_ADMIN')` checks on mutation endpoints (`POST, PATCH, DELETE`). All `req.user.businessId` constraints automatically restrict them.
- **Normal Employee**: Endpoints like `GET /api/profiles/me` explicitly query against their authenticated ID: 
```typescript
getMe = async (req: Request, res: Response, next: NextFunction) => {
  const prof = await this.service.getByUserId(req.user!.id, req.user!.businessId);
  res.json({ profile: prof });
}
```
*(Validation of Department Heads' visibility across the tree relies on similar validation constraints restricting directory parsing).*

## 5. Audit Logging Wrapper
Every mutation across these 3 new branches securely routes through the existing resilient `AuditLogService` tracking format. 
*Example implementation inside `position.controller.ts`:*
```typescript
const beforeData = await this.service.getById(req.params.id, businessId);
const pos = await this.service.update(req.params.id, businessId, req.body);
await AuditLogService.log('UPDATE', 'position', pos.id, beforeData, pos, req);
```
