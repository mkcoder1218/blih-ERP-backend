# Complete Subscription Lifecycle

## Commercial source of truth

`Subscription` is the commercial source of truth. `Plan`, `PlanModule` and `PlanFeature` describe what is sold; `BusinessModule` is the runtime access cache. Every plan assignment or plan change reconciles the business modules so the displayed subscription and actual ERP access cannot drift apart.

## Plan builder

Platform Super Admin can create arbitrary plans and configure:

- monthly and administrator-defined yearly pricing;
- included seats and extra-seat price;
- module entitlements;
- feature entitlements;
- slider/input/unlimited feature limits;
- metered overage price;
- plan lifecycle defaults such as grace period, post-expiry access, data retention and downgrade behavior.

Policy resolution order is platform default -> plan default -> business override.

## Business onboarding

A new business must have a selected plan. Business creation also creates the subscription and synchronizes plan modules. The admin can choose monthly/yearly billing, a custom trial duration and per-business lifecycle policy.

- Trial configured: subscription starts as `trialing` without payment details.
- No trial: subscription starts as `pending_payment`; an initial invoice is created and the ERP remains billing-only until payment is confirmed.

Historical businesses without a subscription retain legacy access until a subscription is explicitly assigned, avoiding an accidental production-wide lockout during rollout.

## Manual payment lifecycle

Current payment provider is `manual`.

Platform Super Admin can record amount, date, reference, notes and an optional PNG/JPG/PDF receipt. Payments are ledger entries tied to a subscription invoice. When the invoice becomes fully paid:

- initial invoice -> subscription becomes active;
- prorated upgrade invoice -> pending plan is applied and entitlements synchronize;
- renewal invoice -> a new billing period is activated.

System-generated invoice PDFs and payment receipt PDFs are available to Business Admin and Platform Super Admin. Uploaded original receipt attachments are also downloadable.

## Plan changes

### Upgrade

Upgrades are immediate after payment and prorated by the remaining fraction of the current paid period. The plan is stored as `pendingPlanId`, a prorated invoice is created, and the target plan is applied only when that invoice is fully paid. Platform Super Admin can force an immediate administrative plan override.

### Downgrade

Downgrades apply immediately with a prorated credit stored on the subscription and applied to future invoices. If the new plan is below current usage, policy controls whether the downgrade is blocked, allowed with a warning, or allowed while new usage is restricted by feature limits. Existing employees/data are never automatically deleted.

## Access lifecycle

The lifecycle processor runs hourly.

`trialing -> pending_payment -> active -> past_due -> expired`

Cancellation is scheduled at period end and becomes `canceled`. Platform suspension becomes `suspended` immediately.

Access modes are configurable:

- `full`
- `read_only`
- `business_admin_only`
- `billing_only`
- `locked`

Subscription access is checked centrally after authentication and again by module guards. Billing/subscription and authentication routes remain available so a restricted tenant can understand and restore its account.

## Retention

Cancellation/expiry may set a configurable `retentionUntil`. The lifecycle worker marks when retention has elapsed but deliberately does not destructively purge company data. Permanent deletion remains an explicit Platform Admin operation.

## Metered usage and hard limits

Feature limits are resolved from the current plan plus business overrides. Metered features may exceed their included limit when an overage unit price is configured; usage records then contribute to the next invoice. Non-metered features are blocked at their limit. Employee creation is wired to the `employee_limit` entitlement.

## Administrative controls

Platform Super Admin can:

- assign subscriptions to legacy businesses;
- change plans;
- extend paid time / grant free days;
- apply subscription discounts;
- record manual payments;
- suspend/reactivate;
- override business grace, expiry, retention and downgrade policies;
- override modules and feature limits;
- download invoices, generated receipts and uploaded payment evidence.

Critical mutations are audit logged.
