# Finance Module Foundation Implementation

## Overview

The Finance module delivers a complete invoicing, payment tracking, expense management, and budgeting system that is tightly integrated with the existing CRM (Clients, Deals) and Projects (Milestones) modules. Every query is tenant-scoped by `businessId` and protected by `requireActiveModule('finance')`.

## Models

| Model | Table | Key Fields |
|---|---|---|
| `Invoice` | `finance_invoices` | clientId, projectId, dealId, invoiceNumber, issueDate, dueDate, currency, subtotal, taxTotal, discountTotal, grandTotal, status |
| `InvoiceItem` | `finance_invoice_items` | invoiceId, description, quantity, unitPrice, taxRate, lineTotal |
| `Payment` | `finance_payments` | invoiceId, clientId, amount, currency, paymentDate, method, reference, status |
| `Expense` | `finance_expenses` | requestedByUserId, departmentId, projectId, category, description, amount, expenseDate, status |
| `Budget` | `finance_budgets` | departmentId, name, periodType, periodStart, periodEnd, allocatedAmount, usedAmount, status |

## Associations

- **Business** → `hasMany` Invoice, InvoiceItem, Payment, Expense, Budget
- **User** → `hasMany` Expense (as `submittedExpenses`)
- **Invoice** → `hasMany` InvoiceItem (as `items`), Payment (as `payments`)
- **Invoice** → `belongsTo` Client, Project, Deal
- **Payment** → `belongsTo` Invoice, Client
- **Expense** → `belongsTo` User (as `requestor`), Department, Project
- **Budget** → `belongsTo` Department

## Invoice Status Lifecycle

```
draft → issued → partial → paid
                 ↘ overdue
              ↘ cancelled
```

The `recalculateInvoiceTotal` method runs on every invoice creation and payment recording. It sums all `InvoiceItem.lineTotal` values to derive `subtotal`, then computes `grandTotal = subtotal - discountTotal + taxTotal`. It also sums all completed payments to auto-transition the status:
- If paid ≥ grandTotal → `paid`
- If 0 < paid < grandTotal → `partial`

## Cross-Module Integrations

### Generate Invoice from Project Milestone
`POST /api/finance/invoices/from-milestone` accepts `{ projectId, milestoneId }`.

1. Looks up the Project to get `budget` and `currency`.
2. Looks up the Milestone to get `billingPercent`.
3. Calculates `amount = project.budget × milestone.billingPercent / 100`.
4. Creates a draft Invoice with a single InvoiceItem for that amount.
5. Runs `recalculateInvoiceTotal` to finalise totals.

### Expense → Budget Tracking
When an employee submits an expense with a `departmentId`, the service looks for an active Budget for that department and increments `usedAmount` by the expense amount. This allows real-time budget burn tracking without manual reconciliation.

## Seeded Form Templates

When a business activates the `finance` module, the TemplateService provisions these forms:

1. **Invoice Creation Form** — structured invoice intake
2. **Milestone Billing Form** — milestone-percentage-based billing
3. **Payment Collection Tracking Form** — payment logging
4. **Expense Reimbursement Form** — employee expense claims (includes file field for receipts)
5. **Operational Expense Entry Form** — vendor/operational costs
6. **Annual Budget Submission Form** — department budget proposals
7. **Purchase Request Form** — procurement requests
8. **Payroll Preview & Verification Form** — payroll cycle verification

## API Endpoints

| Method | Route | Role Guard | Description |
|--------|-------|-----------|-------------|
| POST | `/api/finance/invoices` | FINANCE_MANAGER, BUSINESS_ADMIN | Create invoice with optional line items |
| POST | `/api/finance/invoices/from-milestone` | FINANCE_MANAGER, BUSINESS_ADMIN | Generate invoice from project milestone |
| GET | `/api/finance/invoices` | FINANCE_MANAGER, BUSINESS_ADMIN | List invoices (paginated, includes items) |
| POST | `/api/finance/payments` | FINANCE_MANAGER, BUSINESS_ADMIN | Record a payment |
| POST | `/api/finance/expenses` | Any authenticated user | Submit an expense |
| GET | `/api/finance/expenses` | Any (scoped) | List expenses — FINANCE_MANAGER sees all, others see own only |
| POST | `/api/finance/budgets` | FINANCE_MANAGER, BUSINESS_ADMIN | Create a budget |
| GET | `/api/finance/budgets` | FINANCE_MANAGER, BUSINESS_ADMIN | List budgets |

## Permissions Matrix

| Role | Invoices | Payments | Expenses | Budgets |
|------|----------|----------|----------|---------|
| Platform Super Admin | Full | Full | Full | Full |
| Business Admin | Full (own biz) | Full (own biz) | View all (own biz) | Full (own biz) |
| Finance Manager | Full (own biz) | Full (own biz) | View all (own biz) | Full (own biz) |
| Department Head | — | — | View dept (future) | View dept (future) |
| Employee | — | — | Submit & view own | — |

## Notification Hooks

On payment recording and expense submission, the service looks up all users with the `FINANCE_MANAGER` role (via `UserRole` → `Role`) and sends each an `InternalNotifier` alert with:
- `moduleKey: 'finance'`
- `type: 'finance_alert'`
- Contextual title/message describing the event

## Audit Logging

Every write endpoint logs an audit entry via `AuditLogService.log()`:
- `CREATE_INVOICE`, `GENERATE_INVOICE_MILESTONE`
- `LOG_PAYMENT`
- `SUBMIT_EXPENSE`
- `CREATE_BUDGET`

## Testing

Tests are in `tests/finance.test.ts` and cover:
1. **Tenant isolation** — Business B cannot list or interact with Business A invoices/payments
2. **Invoice creation** — Creates invoice with line items, verifies recalculated subtotal
3. **Payment status transition** — Verifies `partial` status after partial payment
4. **Expense submission** — Verifies pending status and employee self-service access scoping

> **Note:** The test suite requires `supertest` and `@types/jest` dev dependencies to be installed before running.

## Files Created / Modified

### Created
- `src/models/Invoice.ts`
- `src/models/InvoiceItem.ts`
- `src/models/Payment.ts`
- `src/models/Expense.ts`
- `src/models/Budget.ts`
- `src/modules/finance/finance.service.ts`
- `src/modules/finance/finance.controller.ts`
- `src/modules/finance/finance.routes.ts`
- `tests/finance.test.ts`

### Modified
- `src/models/index.ts` — registered all 5 Finance models
- `src/models/Business.ts` — added `hasMany` for all Finance models
- `src/models/User.ts` — added `hasMany` Expense (as `submittedExpenses`)
- `src/app.ts` — mounted `/api/finance` route
- `src/modules/moduleTemplate/template.service.ts` — added 8 Finance form templates, removed duplicate stub entry
