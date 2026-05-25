# Approval Workflow Engine Implementation

## Overview
This adds the system's foundational state machine that tracks formal approvals across any abstract feature in the ERP. It provides the mechanism for `multi-step` verifications and action logging.

## 1. Data Models
Located internally in `src/models`:
- **`ApprovalWorkflow`**: The primary blueprint (e.g. "Leave Request Workflow"). Bound to an `entityType` and `moduleKey`.
- **`ApprovalStep`**: A sequential block outlining requirements for one hop the request must take. It controls whether it's the `isFinalStep` and dictates who qualifies as an actor using `approverType` algorithms ("user", "role", or "department").
- **`ApprovalRequest`**: A living instance of a dispatched entity navigating through the workflow. It remembers the `submittedData` payload, its `currentStepId`, and its aggregate string `status` ("pending", "approved", "rejected", "returned").
- **`ApprovalAction`**: Append-only log defining exactly who pressed the button, their decision ("approve", "reject", etc.), and any timestamp comments. 

## 2. Dynamic Progression Loop (`request.service.ts`)
The `actOnRequest(requestId, businessId, userId, payload)` routine validates actions safely and automatically orchestrates pointer swaps in the database to move items forward (or close them) securely.

```typescript
if (payload.action === 'approve') {
  if (step.isFinalStep) {
    await req.update({ status: 'approved', finalDecision: 'approved', completedAt: new Date() });
  } else {
    const nextStep = await this.dal.getNextStep(req.workflowId, step.stepOrder);
    if (nextStep) {
      await req.update({ currentStepId: nextStep.id });
    } else {
      // Emergency termination if workflow step is misconfigured
      await req.update({ status: 'approved', finalDecision: 'approved', completedAt: new Date(), currentStepId: null });
    }
  }
} else if (payload.action === 'reject') {
  await req.update({ status: 'rejected', finalDecision: 'rejected', completedAt: new Date() });
}
```

## 3. Strict Boundary Configurations
- **Platform Admins**: Handled implicitly through override query structures.
- **Business Admin**: Handled by attaching `requireRole('BUSINESS_ADMIN')` wrappers on the `POST /api/approval-workflows` block. They sculpt the workflows their company operates on.
- **Isolations**: All request generations (`submit`) force `req.user.businessId` onto the row's core metadata, meaning malicious endpoints passing fraudulent workflow UUIDs are caught at the `findAll` database DAL layers and prevented from parsing queries.
- **Audit Logging**: Any `submit` or `action` execution gets cleanly routed to `AuditLogService` parallel to standard CRUD actions for traceability. 

## 4. API Flow Example
1. Define Plan `POST /api/approval-workflows`.
2. Add sequence steps `POST /api/approval-workflows/steps`.
3. Submit a live model `POST /api/approval-requests/submit` -> Status: **PENDING**.
4. Act on log `POST /api/approval-requests/:id/act` -> Status swaps through tree and transitions to **APPROVED** once final block is met.
