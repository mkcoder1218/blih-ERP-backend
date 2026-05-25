# Dynamic Form Engine Implementation

## Overview
Replaces hard-coded API parameters with a mutable schema architecture, allowing Business Admins to construct custom workflows (such as "Asset Checkout" or "Probation Review") by defining modular sets of JSON constraints.

## 1. Schema Infrastructure
Located inside `src/models`:
- **`FormDefinition`**: The blueprint grouping metadata (`name`, `status`, `moduleKey`) along with a direct junction to our `ApprovalWorkflow` mapping layer (`requiresApproval`/`approvalWorkflowId`).
- **`FormField`**: Configures inputs (`type`, `label`, `required`, etc.). Forms iterate this array in `orderIndex`.
- **`FormSubmission`**: Instances of a completed layout. It securely maps the payload string into `.data JSONB`, binding tightly to `submittedByUserId`.

## 2. Dynamic JSON Rules Evaluator
Upon hitting `POST /api/form-submissions`, the `SubmissionService` pulls down the cached definition map for the targeted schema. Rather than executing hard-coded controller constraints, it safely iterates its own map:
```typescript
if (payload.status === 'submitted') {
  for (const field of def.fields) {
    if (field.required) {
      const val = payload.data[field.key];
      if (val === undefined || val === null || val === '') {
        throw new Error(\`Field '\${field.label}' is required.\`);
      }
    }
  }
}
```

## 3. Approval Engine Integration
The Form layout has built-in synergy with the `ApprovalWorkflow` engine. If a system is configured to mandate clearance (`requiresApproval: true`), the engine automatically skips manual generation procedures and natively boots up an `ApprovalRequest` thread when `payload.status === 'submitted'`:
```typescript
if (payload.status === 'submitted' && def.requiresApproval && def.approvalWorkflowId) {
  const firstStep = await db.ApprovalStep.findOne({ where: { workflowId: def.approvalWorkflowId }, order: [['stepOrder', 'ASC']] });
  if (firstStep) {
      const req = await db.ApprovalRequest.create({
        businessId,
        workflowId: def.approvalWorkflowId,
        entityType: 'form_submission',
        entityId: sub.id,
        requestedByUserId: userId,
        currentStepId: firstStep.id,
        status: 'pending',
        submittedData: payload.data
      });
      await sub.update({ approvalRequestId: req.id });
  }
}
```

## 4. API Endpoints
All configurations natively restrict traffic against the `tenant (businessId)`:
- `GET/POST/PATCH /api/form-definitions`: Standardized builder APIs (restricted to `BUSINESS_ADMIN`).
- `GET/POST /api/form-submissions`: Live query inputs (accessible across staff).
- All edits map deeply through `AuditLogService` utilizing the established transaction blocks.
