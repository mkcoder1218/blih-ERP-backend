# Blih HR Performance & Exit Process Foundation

## Overview

Finalizing the Human Resources operational scope, this module strictly bounds Employee lifecycle maintenance (post-onboarding). It encapsulates skill evaluations, behavioral limits, training events, and structural off-boarding gracefully mapping directly against the central `EmployeeRecord`.

## Core Models Incorporated

| Model | Table | Execution Role |
|---|---|---|
| `PerformanceReview` | `hr_performance_reviews` | Connects distinct `periodType` snapshots bounding metric payloads internally to explicit reviewer mappings. |
| `TrainingRecord` | `hr_training_records` | Self-served or requested mappings ensuring compliance or skills paths dynamically log structural investments effectively. |
| `DisciplinaryCase` | `hr_disciplinary_cases` | Safe, highly-obfuscated ledgers isolating behavioral grievances structurally dropping standard management transparency boundaries heavily. |
| `ExitProcess` | `hr_exit_processes` | Captures resignation payloads organically mutating Employee status sequentially inside the instance. |

## Structural Restrictions

**1. Disciplinary Wall (Controller Obfuscation):**
`listDisciplinary` employs a custom `restrictDisciplinaryAccess` boundary method directly overriding standard departmental constraints. Un-permissioned supervisors or employees hitting this endpoint inherently yield `throw new Error(...)` structurally resolving generic 403 Forbidden arrays guarding sensitive case files natively.

**2. Organic Offboarding Transitions:**
The `processExit` service inherently binds into existing systems dynamically switching `EmployeeRecord.employmentStatus` internally. If `"hired"` marks the opening bracket, patching an exit to `"in_progress"` explicitly drops the status mapping into `"exiting"`. Marking it natively `completed` inherently bounds it directly to `"terminated"`, protecting structural access points statically.

**3. Test-Case Validations:**
Implicit architectural checks map natively across `tests/performanceExit.test.ts`. Assurances explicitly assert HTTP 403 logic bounds trigger actively isolating execution organically minimizing structural leaks internally.

## Extension Scope Available
The payload heavily bounds `reviewData JSONB` or `resultData JSONB` providing generic scaffolding schemas ready to ingest explicit UI/Frontend Form variables intrinsically mapped from previously seeded templates (E.g. "Incident Report Form") dynamically extending parameters generically out-of-the-box.
