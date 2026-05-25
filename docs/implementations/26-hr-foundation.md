# Blih ERP Backend HR Module Foundation

## Overview

The Human Resources module dictates strict organizational structure, attendance records, case handling, and leave-balance configurations seamlessly connecting with the overarching User, Authentication and RBAC models natively. 

## Included Models

| Model | Table | Purpose |
|---|---|---|
| `EmployeeRecord` | `hr_employee_records` | The primary map linking global `User` ID references with discrete internal identifiers (`employeeCode`, hierarchical `managerUserId`). |
| `LeaveBalance` | `hr_leave_balances` | Accumulator logs dictating native constraints tracking total allotments (`totalDays`) subtracting runtime mapped `usedDays`. |
| `AttendanceRecord` | `hr_attendance_records` | Time tracking mapping explicitly bound to specific users for calculating native overtime allocations. |
| `HRCase` | `hr_cases` | Safe mapping abstracting internal conflicts or performance boundaries securing reporting structures inherently. |

## Architectural Protections

1. **Self-Service Restrictions:**
   The backend completely overrides specific HTTP POST arrays natively explicitly executing `delete updates.salaryInfo` inside `updateSelfRecord`. This prevents an `Employee` from forging API injections attempting to assign themselves `managerUserId` tokens natively.
2. **Salary Masking Pipeline:**
   Inside `getRecord` and `listRecords`, the response dynamically scans `req.user.roles`. Tracing whether the origin represents a `SUPER_ADMIN`, `BUSINESS_ADMIN`, or an explicit `HR_MANAGER`. If identifying standard connections, the internal `.toJSON()` function truncates the `salaryInfo` object from the JSON tree completely restricting cross-site tracking visibility intrinsically.
3. **Template Scaffolding:**
   A native provisioning endpoint `/api/v1/hr/templates` drops fully mapped standard structural logic into the overarching FormSubmission mechanism (establishing Employee Profiling, Leave Requests smoothly without reinventing dynamic field handlers).

## Execution Rules
- `requireActiveModule('hr')` routes inherently wrap the HR boundaries ensuring only Blih instances paying for the HR mapping SaaS bracket resolve HTTP 200 properly.
- All query layers apply generic `{ businessId: req.user.businessId }` filters protecting horizontal tenant boundaries automatically.
