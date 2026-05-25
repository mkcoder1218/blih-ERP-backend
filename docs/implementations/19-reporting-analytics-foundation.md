# Blih Reporting & Analytics Foundation

## Overview

The Reporting & Analytics module acts as the central ingestion and calculation core for ERP-wide intelligence mapping. It features dual tracking pathways: ad-hoc operational reports (`ReportDefinition`/`ReportRun`) and persistent temporal data (`MetricSnapshot`). It is structurally insulated against tenant manipulation via strict `businessId` query enclosures. Every query mechanism restricts raw UI inputs by executing safe service-level query mapping configurations without exposing real SQL capabilities.

## Models

| Model | Table | Purpose |
|---|---|---|
| `ReportDefinition` | `report_definitions` | The primary blueprint mapping frontend layout intent to physical backend DB queries via `queryConfig`. Holds scheduling configurations. |
| `ReportRun` | `report_runs` | Individual execution snapshots bound to a specific `ReportDefinitionId`, capturing timestamped `resultData`. |
| `MetricSnapshot` | `metric_snapshots` | Distinct data-points calculated and persisted in time. Feeds central Dashboard displays (e.g. `total_leads`, `unpaid_invoices`). |

## Key Features

1. **Service-Level Safe Query Execution:**
   The controller blocks arbitrary filtering input natively mapping incoming executions through `ReportingService.runReport()`. Uses `queryConfig: { entity: "Lead", action: "count" }` mapping pattern which verifies bounds organically translating into `db[qc.entity].count({ where: { businessId } })`.

2. **Metrics Automation Array:**
   Endpoint `/api/reporting/metrics/generate` hits `generateBasicMetrics(businessId)`, calculating 360 ERP-wide module statuses instantly. It evaluates underlying HR dependencies, outstanding Finance documents, tracking arrays across the Project task tree, and CRM conversions natively generating `MetricSnapshot` artifacts for consumption.

3. **Query Insulation:**
   Underlying reports do not allow any raw database SQL. Everything wraps inside `Sequelize` operational blocks strictly injecting `businessId` un-overrideably.

## API Matrix

| Route | Execution Flow | Access Requirement |
|---|---|---|
| `POST /api/reporting/definitions`| Build a new layout mapping | Dashboard Admins, Super Admins |
| `GET /api/reporting/definitions`| Retrieve available blueprints | Permitted Users, Dashboard viewers |
| `POST /api/reporting/definitions/:id/run`| Force a fresh recalculation outputting a new `ReportRun` snapshot | Permitted Execution Group |
| `GET /api/reporting/definitions/:id/runs`| Retrieve historic snapshots | Permitted Execution Group |
| `POST /api/reporting/metrics/generate`| Execute total sweeping ERP recalculations mapping status artifacts | Background Worker / Administrator |
| `GET /api/reporting/metrics`| Provide dashboard data payload mapped to modules | Bounded Tenant |

## Audit Logging

Because of data visibility concerns surrounding generated artifacts, running reports produces audit artifacts tracking internal engagement:
- `CREATE_REPORT_DEF`
- `UPDATE_REPORT_DEF` 
- `RUN_REPORT`

## Technical Restrictions Applied
Internal architecture mandates that real scheduled jobs be deferred. Currently, configurations intended to trigger autonomous events are mapped safely within `scheduleConfig` inside `ReportDefinition` acting as declarative state until the system mounts an orchestration queue like `BullMQ`. Client Users (B2B mapped accesses) completely bypass module detection pathways ensuring underlying CRM and Employee artifacts cannot bleed over the public routing surface.
