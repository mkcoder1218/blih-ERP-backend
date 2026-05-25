# Notification Engine Implementation

## Overview
A centralized bus built to securely direct abstract alerts (`in_app`, `email`, `sms`) across tenant architecture.

## 1. Abstraction Models
- **`Notification`**: Direct model. Tracks `title`, `message`, `moduleKey`, and physical mapping UUIDs routing the `senderUserId` to the `recipientUserId`. Uses a `status` matrix mapping ('unread', 'read', 'archived').
- **`NotificationPreference`**: User-defined table that sets rules logic (example: block 'moduleKey: CRM' emails from pushing through externally, but allow `in_app` messages). This provides the configuration foundation for future external APIs.

## 2. Shared Delivery Instance (`InternalNotifier`)
Instead of duplicating schema writes across our modules, the `NotificationService` exports `InternalNotifier`. This acts as an immutable singleton block that other services cleanly await.
```typescript
import { InternalNotifier } from '../notification/notification.service';

if (firstStep.approverUserId) {
    await InternalNotifier.send({
      businessId,
      recipientUserId: firstStep.approverUserId!,
      senderUserId: userId,
      moduleKey: wf.moduleKey || 'approval',
      type: 'approval_required',
      title: 'New Approval Request',
      message: \`You have a new approval request for workflow: \${wf.name}\`,
      entityType: 'approval_request',
      entityId: req.id,
      priority: 'high'
    });
}
```

## 3. Active Cross-Module Integrations
- **`request.service.ts`**: Automatically tracks `submit()` execution boundaries and dynamically routes a ping to `firstStep.approverUserId` signaling a tree requires clearance. Additionally, `reject()`, `approve()`, and `return()` functions natively intercept the actor's decision logic and bounce a ping backward alerting `req.requestedByUserId` of completion.
- **`submission.service.ts`**: Monitors form definitions utilizing an `approvalWorkflowId` boundary. Whenever an employee creates a complex JSON form and an approval sequence trips natively, the dispatcher natively inherits the notification dispatch array alongside the `ApprovalRequest` UUID creation logic.

## 4. Hierarchy Read Constraints
The API `list` controllers rigorously map queries against `recipientUserId`. Only pure `req.user.id` identities will view messages assigned backward to them. 

The `BUSINESS_ADMIN` parameter dynamically overrides the native payload query, transforming the generic user fetch into an all-encompassing `findAll()` loop mapping cross-tenant. However, the message payload safely intercepts generic content unless the boundary maps out to a `PLATFORM_SUPER_ADMIN`:

```typescript
if (queryOptions.overrideUserId && !req.user!.isPlatformSuperAdmin) {
  data.rows = data.rows.map((r: any) => {
    const d = r.toJSON();
    d.message = "*** Filtered for Privacy ***";
    return d;
  });
}
```
