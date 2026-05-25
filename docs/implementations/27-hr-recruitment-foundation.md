# Blih HR Recruitment & Onboarding Foundation

## Overview

Extends the core Human Resources module structuring an end-to-end applicant tracking matrix. Bridges external job applicants securely without compromising the explicit internal `businessId` boundaries mapped dynamically by routing logic safely separating public logic.

## Models Included

| Model | Table | Purpose |
|---|---|---|
| `JobOpening` | `hr_job_openings` | Standard definitions mapping requested heads organically resolving inside targeted `departmentId` blocks. |
| `JobApplication` | `hr_job_applications` | Holds external contacts filtering applicant mapping through structured stages transitioning logically to hiring events. |
| `Interview` | `hr_interviews` | Organizes specific scheduling mappings explicitly linking internal Users to candidate interfaces caching internal reviewer scorecards natively. |
| `OnboardingTask` | `hr_onboarding_tasks` | Automated matrices mapped against recently hired identities managing `assignedToUserId` task fulfillment organically. |

## Workflow Pipeline Actions

**1. Public Access Routing:**
- Constructed explicit express Router instance (`publicRecruitmentRoutes`) mounted intentionally **before** the root `requireActiveModule` and global Auth limits natively. 
- Prevents structural HTTP 403 blocks for standard external users sending payload directly to `/api/v1/hr/public/job-openings/:id/apply`.

**2. Automated Transitioning (`hired` payload):**
- When `HR_MANAGER` or `BUSINESS_ADMIN` executes `PATCH /recruitment/applications/:id/stage` tracking string `"hired"`, the secondary native service boundaries implicitly bind dynamically:
   a. **Provision EmployeeRecord**: Evaluates `email` against User map mapping organic ID boundaries natively wrapping internal mapping codes automatically (`EMP-####`).
   b. **Deploy OnboardingTask**: Constructs native provisioning arrays natively requesting Profile updates.

**3. Safety Rules Implementation:**
- Hardcoded attribute whitelisting explicitly prevents payload-injection natively inside `RecruitmentService.publicApply` mapping entirely explicit `{ fullName, email, phone, etc }` attributes, neutralizing unauthorized score mapping.
- Internal explicit interview `feedback` parameters remain bound solely inside `/api/v1/hr/recruitment` natively blocking un-authenticated external endpoints entirely.
