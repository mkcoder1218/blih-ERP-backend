# Blih Background Job Worker Foundation

## Overview

The Background Job Worker foundation orchestrates asynchronous, temporally-bound operations operating continuously parallel to standard HTTP handlers. Built atop `node-cron`, it allows generic task definitions encompassing CRM sweeps, billing triggers, and routine maintenance without delaying standard API returns.

## Core Dependencies & Architectural Rules

- **Execution Driver:** Relies natively on `node-cron` integrated directly within `src/server.ts` upon bootstrap conditionally triggering only if `JOB_WORKER_ENABLED=true` inside `.env`.
- **Temporal Configuration:** Tasks observe the locally scoped `JOB_TIMEZONE`.
- **Concurrency Isolation:** Jobs inherently use memory locks (`Set<string>` maps inside `runner.ts`) guaranteeing singular execution contexts. If an 8:00AM cron executes identically overlapping a stalled 7:59AM process, it gracefully drops averting data collision organically.

## The Model Context `BackgroundJobLog`

| Field | Purpose |
|---|---|
| `jobName` | Identifies the physical function name executing |
| `status` | Defaults to `pending`, transitions structurally to `running`, `success`, or `failed` |
| `startedAt`/`finishedAt` | Absolute boundaries tracking individual latency bottlenecks |
| `errorMessage` | Caches unhandled stack exceptions inside standard DB logs preventing shell trace loss natively |

## Scaffolded Daily Jobs

| Job Routine | Cron Boundary | Handled Context |
|---|---|---|
| `approvalDeadlineReminder` | `0 8 * * *` | Recursively finds stranded HR/Project forms pushing soft-notifications down to stalled managers. |
| `overdueInvoiceReminder` | `0 8 * * *` | Inspects billing constraints globally identifying lapsed finance instruments. |
| `subscriptionExpiryCheck` | `0 0 * * *` | Bypasses individual constraints forcing hard "Expired" status updates terminating access precisely on midnight. |
| `trialExpiryReminder` | `0 9 * * *` | Sends automated upsell and notification mappings directly to instances ending. |
| `scheduledReportRunner`| `0 * * * *` | Sweeps definitions possessing `{ schedule: 'hourly' }` producing analytics payloads implicitly. |
| `inactiveUserCleanupCheck`| `0 2 * * 0` | Triggers on Sunday at 2 AM safely restricting identities violating dormant compliance parameters. |

## Extension Guidelines
1. Compose new functions logically inside `src/jobs/handlers/`.
2. Construct definitions mapping the `JobDefinition` interface:
```typescript
{
  name: 'JobNameMap',
  type: 'billing',
  cronExpression: '<cron-str>',
  handler: async () => { ... }
}
```
3. Load the function mapping linearly inside `src/jobs/registry.ts`.
4. Ensure target tables structurally verify `{ where: { status: 'active' } }` natively bypassing suspended businesses to reduce CPU overhead.
