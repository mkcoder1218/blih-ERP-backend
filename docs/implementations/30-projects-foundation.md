# Blih Projects Module Foundation

## Overview

The Projects architecture binds deeply into the CRM conversion cycles, orchestrating highly connected delivery mapping directly upon successful Deal closure. It formally captures `Milestones`, `Tasks`, `Issues`, and explicitly abstracts out `ChangeRequests` for audit logging gracefully out of the box.

## Core Models

| Model | Table | Execution Role |
|---|---|---|
| `Project` | `projects` | Hub mapping. Explicitly maintains Budget, Currency, active boundaries, abstract statuses tracking overall pipeline deployments. |
| `ProjectMilestone` | `project_milestones` | Structural segmentation. Binds directly to abstract `billingPercent` parameters implicitly mapped without invoking full Finance systems directly yet. |
| `ProjectTask` | `project_tasks` | Operational atom. Tracks explicitly bound properties isolating `estimatedHours` against user progress natively. |
| `ProjectIssue` | `project_issues` | Safely traps anomalies linking them optionally into explicit `taskId` references directly logging severity levels. |
| `ProjectChangeRequest` | `project_change_requests` | Formal bounds strictly separating explicit shifts in scope transferring parameters recursively over native `impactOnCost` modifiers organically out-of-the-box. |

## Dynamic Logic Triggers

**1. Deal Handoff Automations:**
The architecture provides an explicit endpoint (`/from-deal`) executing `createProjectFromDeal`. The method verifies the source deal naturally ensures it marks `"status": "won"` natively, mapping currency flags and values straight into the root `budget` organically logging `deal_conversion` internally.

**2. Progress Resolution Mappings:**
The API inherently serves `getProjectProgress` endpoints calculating array mathematics locally comparing total defined tasks specifically executing `"done"` constraints outputting structured values: `totalTasks`, `completedTasks`, `progressPercent`.

**3. Event Broadcasters:**
Tasks and issues structurally notify assignments gracefully wrapping the native `InternalNotifier` structurally sending direct system payloads dynamically mapped to `moduleKey: 'projects'` intrinsically wrapping bounds neatly natively.
