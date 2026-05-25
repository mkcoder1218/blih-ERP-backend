# Blih OKR Module Foundation Implementation

## Overview

The OKR (Objectives and Key Results) module facilitates company-wide goal setting, alignment, and performance tracking. It provides hierarchical objectives (company, department, team, personal), measurable key results, progress update tracking, and managerial evaluations. Every query is tenant-scoped by `businessId` and protected by `requireActiveModule('okr')`.

## Models

| Model | Table | Purpose |
|---|---|---|
| `Objective` | `okr_objectives` | High-level goals (Company, Department, Team, Personal) |
| `KeyResult` | `okr_key_results` | Measurable outcomes tied to an Objective with baseline/target values and weighting |
| `OKRProgressUpdate` | `okr_progress_updates` | Incremental updates logging progress towards a Key Result |
| `OKREvaluation` | `okr_evaluations` | Managerial assessments of an Objective's final performance |

## Features & Workflows

### Progress Calculation

Progress updates are logged against `KeyResults`. When `logProgressUpdate` is called:
1. The new `progressPercent` of the target `KeyResult` is assessed.
2. The `currentValue` of the `KeyResult` is updated to the `progressValue`.
3. The parent `Objective`'s overall progress is automatically recalculated using the weighted average of all its `KeyResults`:
   ```math
   \text{Overall Progress} = \frac{\sum (\text{Key Result } \% \times \text{Weight})}{\sum \text{Weights}}
   ```
4. The recalculated overall progress is stored in the `Objective.metadata.calculatedProgress`.

### Role-Based Access Control

- **Platform Super Admin**: Can view/manage across all businesses.
- **Business Admin**: Manage all OKR setup within their business boundary.
- **HR Manager**: Oversee all company/department OKR cycles (`HR_MANAGER`).
- **Department Head**: Manage OKRs corresponding to their department (`DEPARTMENT_HEAD`).
- **Manager**: Review/Evaluate assigned team OKRs.
- **Employee**: Create personal OKRs and submit standard progress updates.

## API Endpoints

| Method | Route | Description | Action/Role |
|--------|-------|-------------|-------------|
| POST | `/api/okr/objectives` | Create a new Objective | Any Auth |
| GET | `/api/okr/objectives` | List/Search Objectives | Any Auth |
| GET | `/api/okr/objectives/:id` | Get Objective with Key Results | Any Auth |
| PATCH| `/api/okr/objectives/:id` | Edit an Objective | Owner / Manager |
| POST | `/api/okr/key-results` | Attach a Key Result to an Objective | Objective Owner |
| PATCH| `/api/okr/key-results/:id` | Update a Key Result | Objective Owner |
| POST | `/api/okr/progress` | Log progress on a Key Result | Objective Owner |
| POST | `/api/okr/evaluations` | Create a Manager Evaluation | HR_MGR, BUS_ADMIN, DEPT_HEAD |

## Notifications & Logging

- **Updates**: When a user logs progress, if they are not the `ownerUserId` of the objective, the owner receives an `InternalNotifier` alert (`okr_progress_update`).
- **Evaluations**: When a manager submits an evaluation, the objective owner receives an alert (`okr_evaluation`).
- **Audit**: Write actions (`CREATE_OBJECTIVE`, `UPDATE_KEY_RESULT`, `LOG_OKR_PROGRESS`, `EVALUATE_OBJECTIVE`) log deeply via `AuditLogService`.

## Seeded Form Templates (6)

Upon OKR module activation via `TemplateService`, 6 forms are generated:
1. **Company Annual OKR Submission Form**
2. **Department Quarterly OKR Submission Form**
3. **Personal OKR Creation Form**
4. **Monthly OKR Progress Update Form**
5. **Manager OKR Evaluation Form**
6. **Annual Performance Summary Form**

## Testing

Tests are populated in `tests/okr.test.ts` to assert:
- `Tenant Isolation`: Business A cannot access or manipulate Business B's OKRs.
- `Objective/KeyResult Lifecycle`: Create operations assert proper initial baseline values.
- `Progress Integrity`: Ensuring that a 50% completion translates correctly to the recalculation hook.

## Next Steps / Extensibility

The `KeyResult` model is provisioned with a `dataSource` enumerator (currently `manual`), intended specifically for future automated integrations. Future enhancements can utilize `finance`, `crm`, or `projects` source modes to auto-update the `currentValue` without manual intervention (e.g., closing deals automatically bumps a sales KR).
