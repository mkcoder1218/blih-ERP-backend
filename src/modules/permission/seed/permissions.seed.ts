export const SYSTEM_PERMISSIONS = [
  // Core: Users
  { module: "user", action: "read", key: "user.read", description: "View users and their basic info" },
  { module: "user", action: "create", key: "user.create", description: "Create new user accounts" },
  { module: "user", action: "update", key: "user.update", description: "Update user profile and status" },
  { module: "user", action: "delete", key: "user.delete", description: "Deactivate or remove user accounts" },

  // Core: Roles & Permissions
  { module: "role", action: "read", key: "role.read", description: "View system roles" },
  { module: "role", action: "create", key: "role.create", description: "Create new custom roles" },
  { module: "role", action: "update", key: "role.update", description: "Modify existing role permissions" },
  { module: "role", action: "delete", key: "role.delete", description: "Delete non-system roles" },
  { module: "permission", action: "read", key: "permission.read", description: "View available system permissions" },
  { module: "permission", action: "manage", key: "permission.manage", description: "Assign permissions to roles" },

  // Recruitment & Jobs (Expanded)
  { module: "job", action: "read", key: "job.read", description: "View job listings and pipelines" },
  { module: "job", action: "manage", key: "job.manage", description: "Complete control over job lifecycle" },
  { module: "job", action: "post", key: "job:post", description: "Post and publish job openings" },
  { module: "job", action: "archive", key: "job.archive", description: "Archive or close job listings" },
  { module: "job_template", action: "read", key: "job_template.read", description: "View recruitment templates" },
  { module: "job_template", action: "manage", key: "job_template.manage", description: "Create and edit recruitment forms and templates" },
  
  // Applicants & Interviews
  { module: "applicant", action: "read", key: "applicant.read", description: "View candidate profiles and resumes" },
  { module: "applicant", action: "manage", key: "applicant.manage", description: "Process candidates through pipeline stages" },
  { module: "interview", action: "schedule", key: "interview.schedule", description: "Schedule and manage interview slots" },
  { module: "interview", action: "feedback", key: "interview.feedback", description: "Submit and view interview evaluations" },
  
  // Offers & Onboarding
  { module: "offer", action: "create", key: "offer.create", description: "Generate offer letters for candidates" },
  { module: "offer", action: "approve", key: "offer.approve", description: "Approve or reject pending offer letters" },
  { module: "onboarding", action: "read", key: "onboarding.read", description: "View onboarding progression" },
  { module: "onboarding", action: "manage", key: "onboarding.manage", description: "Manage onboarding tasks and checklists" },

  // HR & Employee Management
  { module: "hr", action: "read", key: "hr.read", description: "View employee records" },
  { module: "hr", action: "write", key: "hr.write", description: "Update employee data and contracts" },
  { module: "profiles", action: "read", key: "profiles.read", description: "Access the employee directory" },
  { module: "department", action: "create", key: "department.create", description: "Create departments" },
  { module: "department", action: "update", key: "department.update", description: "Update departments" },
  { module: "department", action: "delete", key: "department.delete", description: "Delete departments" },
  { module: "position", action: "create", key: "position.create", description: "Create positions" },
  { module: "position", action: "update", key: "position.update", description: "Update positions" },
  { module: "position", action: "delete", key: "position.delete", description: "Delete positions" },

  // Modules: CRM & Projects
  { module: "crm", action: "read", key: "crm.read", description: "View leads and customers" },
  { module: "crm", action: "manage", key: "crm.manage", description: "Manage sales deals and accounts" },
  { module: "project", action: "read", key: "project.read", description: "View project dashboards" },
  { module: "project", action: "manage", key: "project.manage", description: "Manage project tasks and timelines" },

  // Finance & Operations
  { module: "finance", action: "read", key: "finance.read", description: "View financial reports" },
  { module: "finance", action: "manage", key: "finance.manage", description: "Process invoices and expenses" },
  { module: "payroll", action: "read", key: "payroll.read", description: "View payroll history" },
  { module: "payroll", action: "run", key: "payroll.run", description: "Execute payroll cycles" },

  // Attendance & Time
  { module: "attendance", action: "read", key: "attendance.read", description: "View attendance logs" },
  { module: "attendance", action: "manage", key: "attendance.manage", description: "Adjust timesheets and shifts" },
  { module: "leave", action: "read", key: "leave.read", description: "View leave balances" },
  { module: "leave", action: "approve", key: "leave.approve", description: "Approve or deny leave requests" },

  // Performance & Growth
  { module: "performance", action: "read", key: "performance.read", description: "View own performance metrics" },
  { module: "performance", action: "manage", key: "performance.manage", description: "Perform appraisals and set OKRs" },

  // System Administration
  { module: "settings", action: "read", key: "settings.read", description: "View company settings" },
  { module: "settings", action: "update", key: "settings.update", description: "Update company branding and config" },
  { module: "module", action: "manage", key: "module.manage", description: "Enable or disable ERP modules" },
];
