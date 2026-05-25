# Blih Billing & Subscription Foundation

## Overview

The Billing and Subscription management foundation governs the SaaS boundaries inherent to Blih ERP as a multi-tenant platform. It controls explicit system access (locking businesses out of their instance upon suspension), establishes hard limits regarding user counts and storage allocation mapping against pricing structures, and generates/tracks invoices representing system usage internally.

## Models

| Model | Table | Purpose |
|---|---|---|
| `Subscription` | `subscriptions` | The root anchor tying a `businessId` to a specific `planId` and billing cycle. Tracks `status` globally. |
| `SubscriptionInvoice` | `subscription_invoices` | Billing artifacts mapping due amounts against standard cycles. |
| `SubscriptionPayment` | `subscription_payments` | Distinct transaction ledgers fulfilling invoices mapping metadata from external gateways (e.g. Stripe refs). |
| `UsageLimit` | `usage_limits` | Highly granular boundaries dynamically tracking metrics like absolute `user` counts. Limits default to their `limitValue` or uncap if set to `-1`. |

## Core Operational Logic & Protections

### Business Logic Control (Middlewares)

The foundation injects two extremely critical middlewares (`src/middlewares/subscription.ts`) intended for broad route consumption:

1. **`requireActiveSubscription`**:
   Before releasing the primary controller execution context, this checks whether the business account mapping the JWT token holds an `active` or `trial` state. If the subscription reads exactly as `past_due`, `suspended`, `cancelled`, or `expired`, a hard `403 Forbidden` terminates all processing ensuring non-paying tenants cannot utilize system functionality.

2. **`requireUsageLimit(limitKey)`**:
   An explicit route-blocker. If a `BUSINESS_ADMIN` attempts `POST /api/user`, the `requireUsageLimit('users')` intercept recalculates the current physical user count mapping against `UsageLimit` values natively. Requests over boundary bounds receive `402 Payment Required`.

## Role Accessibility 

- The `SUPER_ADMIN` maps absolutely over all tables directly utilizing routes to construct instances (`POST /assign`) and ledger updates (`POST /invoices/:invoiceId/payments`).
- The `BUSINESS_ADMIN` inherently possesses READ access mapped against their specific `businessId` scope to view `/invoices` and trigger `/cancel` safely.
- Ordinary endpoints map purely inside internal ERP logic bypassing subscription ledgers entirely ensuring lower-level operators cannot inspect tenant billing parameters.

## API Execution Endpoints

| Resource Matrix | Actor | Description |
|---|---|---|
| `GET /api/subscription` | `BUS_ADMIN` | Views tenant status boundaries. |
| `POST /api/subscription/cancel` | `BUS_ADMIN` | Immediately triggers `status` transition terminating active access parameters organically. |
| `POST /api/subscription/assign` | `PLAT_ADMIN` | Attaches a tenant cleanly to an initialized `planId` resetting tracking parameters. |
| `GET /api/subscription/invoices`| `BUS_ADMIN` | Read-only extraction. |
| `POST /api/subscription/invoices`| `PLAT_ADMIN` | Force invoice emissions into the tenant ledger. |

## Audit Logging

Given structural business implications, modifications trigger native `AuditLogService` tracing on parameters including:
- `CANCEL_SUBSCRIPTION` 
- General execution tracks map explicitly inside routine audit architectures for billing transparency.
