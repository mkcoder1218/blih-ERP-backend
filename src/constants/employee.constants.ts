export const EMPLOYMENT_STATUSES = [
  "onboarding",
  "active",
  "inactive",
  "on_leave",
  "terminated",
] as const;

export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contractor",
  "intern",
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const DEFAULT_EMPLOYMENT_STATUS: EmploymentStatus = "onboarding";
export const DEFAULT_EMPLOYMENT_TYPE: EmploymentType = "full_time";
export const ACTIVE_EMPLOYMENT_STATUS: EmploymentStatus = "active";
export const INACTIVE_EMPLOYMENT_STATUS: EmploymentStatus = "inactive";
export const TERMINATED_EMPLOYMENT_STATUS: EmploymentStatus = "terminated";
