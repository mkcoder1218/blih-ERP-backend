# Blih Admin Operations Foundation

## Overview

The Admin Operations module establishes a high-fidelity control mechanism intended strictly for super-system operators (`SUPER_ADMIN`). It provides explicit, thoroughly audited pathways for technical support staff to temporarily access or impersonate localized tenants without accessing raw database secrets or demanding tenant passwords, ensuring compliance with strict external access boundaries.

## Models

| Model | Table | Purpose |
|---|---|---|
| `SupportAccessLog` | `support_access_logs` | Logs when a platform operator formally requests and establishes a direct read/write pipeline to a tenant's internal instance dashboard. Mandates a tracking reason. |
| `AdminImpersonationSession` | `admin_impersonation_sessions` | Tracks explicit token-exchanges where a support administrator borrows a tenant user's (`targetUserId`) identity. |
| `SystemHealthLog` | `system_health_logs` | Background tracking records evaluating DB/Redis/Storage component latency metrics locally. |
| `BackgroundJobLog` | `background_job_logs` | Asynchronous task executions historically documented providing auditing for cron mutations (e.g. bulk billing scripts). |

## Impersonation Design Architecture

The process of impersonation follows extremely strict parameters:
1. **Target Bound:** The `SUPER_ADMIN` defines the exact `targetUserId` and `reason` when calling `/api/admin-ops/impersonate`.
2. **Exclusion Parameter:** The controller ensures that the `targetUserId` is *never* another `SUPER_ADMIN`, eliminating chained escalation paths natively.
3. **Ghost Tokens:** Instead of resetting passwords, a temporal JWT is emitted containing `"id": targetUser.id`, mimicking native auth routines, but explicitly injecting `"impersonatedBy": platformUserId`. 
4. **Middleware Capture:** The `captureImpersonation` interceptor sits within the broader request pipeline. If a "Ghost Token" performs actions (e.g. creating a lead), the interceptor tracks the true `impersonatedBy` mapping, logging it intrinsically via the `AuditLogService` mitigating deniability.

## Exposed Routines

| Route | Execution Flow | Access Requirement |
|---|---|---|
| `GET /api/admin-ops/health`| Polls underlying components mapping system status | `SUPER_ADMIN` |
| `POST /api/admin-ops/support-access`| Constructs a logged explicit connection boundary | `SUPER_ADMIN` |
| `POST /api/admin-ops/impersonate` | Generates Ghost Token overriding auth pipelines | `SUPER_ADMIN` |
| `GET /api/admin-ops/support-logs` | Queries historical access traces per business | `SUPER_ADMIN`, `BUSINESS_ADMIN` |

## Security Rules Embedded
- All passwords/secrets are strictly natively bypassed leveraging signed JWT explicit token definitions (never exposing keys).
- Time bounds natively apply since Impersonation Sessions inherit strict (e.g. `1h`) expiry mapping matching normal token expirations natively.
