# CRM Module Foundation Implementation

## Overview
Built parallel to the existing structure mapping natively over the Form Submissions module, the active CRM logic enforces tenant bounded logic wrapping `Lead`, `Client`, `Deal`, and tracking native `Interaction` mapping automatically updating abstract lead-progression forms dynamically.

## 1. CRM Schema Blueprints (`template.service.ts`)
Attached to the global DB hook interceptor! When a Business upgrades via their Plan Modules mapping directly integrating CRM, the `BusinessModule` initialization intercepts the abstract system maps parsing the global Template mapping and instantly assigns tenant-locked exact templates explicitly linking:
- New Lead Intake Form
- Lead Qualification Form
- Interaction Form
- Proposal Request Form
- Deal Win/Loss Form
- Client Onboarding Checklist Form

## 2. Advanced CRM Flow Architecture 
### Dynamic Conversions
A `Lead` isn't merely string updated. When hitting `POST /api/crm/leads/:id/convert`, the service implicitly:
1. Rebuilds the schema boundary instantiating a fresh `Client`.
2. Re-maps existing metadata natively converting names arrays appropriately mapped towards standard `accountManagerUserId`.
3. Toggles the original `Lead` map to `status: "converted"`.

### Assignment & Internal Polling
When calling the patch mapping (`assignLead`), the CRM Engine utilizes cross-module logic explicitly triggering the `InternalNotifier` system. This binds automated routing notifications towards the tracked targeted `$assignedToUserId` securely ensuring sales members trigger in-app pings cleanly.

### Deal Stages hook updates (`Interaction` wrapper logic)
Following the instruction `"Only Interaction form can update lead stage"`, standard leads explicitly lock their `stage` fields. However! If a Sales member provisions a new `Interaction` logging an action, the backend `logInteraction` service dynamically traces back towards the bounded `leadId` parsing `stageAfterInteraction`. If present, it forcefully patches the matching `Lead` updating their active mapped location!

## 3. Scope Validations
In `crm.controller.ts`, queries tracking collections (`listLeads`, `listDeals`) aggressively isolate boundaries mapping towards:
- Super Admins / `CRM_MANAGER` / `BUSINESS_ADMIN` bypass logic: Seeing complete collection arrays per business limit.
- Baseline `Owner`: Queries hard restrict directly returning targets strictly matching explicitly defined `.ownerUserId` avoiding unauthorized cross-lead scraping explicitly!

## 4. Tests
Basic implementation bounds testing explicit limits generated mirroring the integration flow bounds mapped cleanly within `tests/crm.test.ts`. 
