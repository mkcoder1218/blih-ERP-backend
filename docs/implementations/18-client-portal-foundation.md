# Blih Client Portal Foundation Implementation

## Overview

The Client Portal module establishes a secure, isolated gateway allowing external clients to interact with Blih ERP. It provides clients with limited, strictly bounded access to their own projects, invoices, and deliverables, while offering dedicated channels for support requests and CSAT/NPS feedback. Internal ERP data (HR, Brain, internal CRM metrics) remains entirely inaccessible to portal users.

## Models

| Model | Table | Purpose |
|---|---|---|
| `ClientPortalUser` | `client_portal_users` | The identity mapping for a portal-enabled external user. |
| `ClientPortalAccess` | `client_portal_accesses` | Granular permission junction mapping users to specific projects or data subsets. |
| `ClientRequest` | `client_requests` | Support requests, change requests, or general inquiries logged by the client. |
| `ClientFeedback` | `client_feedbacks` | Ratings, NPS scores, and qualitative feedback captured from external clients. |

## Data Isolation & Security Topology

**Dual-Phased Authorization Array:**
1. All client portal routes reside under `/api/client-portal` and invoke a specialized middleware (`requirePortalUser`).
2. `requirePortalUser` fetches the `ClientPortalUser` entity mapped against `req.user.id` and the tenant `businessId`. If the logged-in user is not a formally activated client portal identity, the endpoint rejects the attempt with `403 Forbidden`.

> **Note:** Client users hold structural User records to utilize the standard JWT system, but lack internal permissions (like `HR_MANAGER` or `SALES_REP`). Instead, their interactions are strictly confined to the `portalUser` boundaries mapping them to `clientId`.

## Features

### External Experience (`/api/client-portal/*`)
- **My Projects:** Queries `Project` model bounded strictly to the user's `clientId`. Returned definitions are sanitized, omitting sensitive financial columns like margins or budgets.
- **My Invoices:** Exposes the `Invoice` ledger related to their account (grand totals, issue dates, status statuses tracking).
- **My Requests:** Facilitates structured support logging directly to their Account Management pipeline.
- **My Feedbacks:** Subsumes arbitrary email chains into structured, analyzable NPS + CSAT metrics mapping straight to the business dashboard.

### Internal Context
- **Setup API:** Secure endpoints accessible exclusively by `ACCOUNT_MANAGER` and `BUSINESS_ADMIN` enabling the initialization and provisioning of `ClientPortalUser` artifacts, linking their `clientId`.
- **Alert Routing:** The completion of a client request or feedback triggers the `InternalNotifier` system, actively pinging the underlying `Client`'s associated `accountManagerUserId`.

## API Matrix

| Route | Accessible By | Purpose |
|---|---|---|
| `POST /api/client-portal/users` | Internal (Admin/AM) | Provision a new portal identity. |
| `POST /api/client-portal/access` | Internal (Admin/AM) | Grant specific project access permissions. |
| `GET /api/client-portal/my-projects` | Portal Client | List actively mapped external projects. |
| `GET /api/client-portal/my-invoices` | Portal Client | Retrieve pending and closed invoices. |
| `POST /api/client-portal/my-requests` | Portal Client | Create a support/change request. |
| `POST /api/client-portal/my-feedbacks` | Portal Client | Push an NPS or deliverable rating. |

## Interacting Modules

The portal bridges across several distinct foundations:
- **CRM:** The `Client` relationship establishes absolute visibility gating.
- **Projects:** Exposes ongoing work tracking.
- **Finance:** Channels invoice rendering.
- **Notifications:** Wires the external operations into internal dashboards.

## Audit Logs

As with internal modules, the `AuditLogService` deeply traces critical boundaries:
- `CREATE_PORTAL_USER`
- `CREATE_PORTAL_ACCESS`

(Standard HTTP logging handles external user footprinting).
