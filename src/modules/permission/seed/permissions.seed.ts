export const SYSTEM_PERMISSIONS = [
  // ── Core: Users ─────────────────────────────────────────────────────────────
  { module: "user", action: "read",   key: "user.read",   description: "View users and their basic info" },
  { module: "user", action: "create", key: "user.create", description: "Create new user accounts" },
  { module: "user", action: "update", key: "user.update", description: "Update user profile and status" },
  { module: "user", action: "delete", key: "user.delete", description: "Deactivate or remove user accounts" },

  // ── Core: Roles & Permissions ────────────────────────────────────────────────
  { module: "role",       action: "read",   key: "role.read",         description: "View system roles" },
  { module: "role",       action: "create", key: "role.create",       description: "Create new custom roles" },
  { module: "role",       action: "update", key: "role.update",       description: "Modify existing role permissions" },
  { module: "role",       action: "delete", key: "role.delete",       description: "Delete non-system roles" },
  { module: "permission", action: "read",   key: "permission.read",   description: "View available system permissions" },
  { module: "permission", action: "manage", key: "permission.manage", description: "Assign permissions to roles" },

  // ── Recruitment & Jobs ───────────────────────────────────────────────────────
  { module: "job",          action: "read",    key: "job.read",           description: "View job listings and pipelines" },
  { module: "job",          action: "manage",  key: "job.manage",         description: "Complete control over job lifecycle" },
  { module: "job",          action: "post",    key: "job.post",           description: "Post and publish job openings" },
  { module: "job",          action: "update",  key: "job.update",         description: "Edit existing job openings" },
  { module: "job",          action: "archive", key: "job.archive",        description: "Archive or close job listings" },
  { module: "job_template", action: "read",    key: "job_template.read",  description: "View recruitment templates" },
  { module: "job_template", action: "manage",  key: "job_template.manage",description: "Create and edit recruitment forms and templates" },

  // ── Applicants & Interviews ──────────────────────────────────────────────────
  { module: "applicant", action: "read",     key: "applicant.read",    description: "View candidate profiles and resumes" },
  { module: "applicant", action: "manage",   key: "applicant.manage",  description: "Process candidates through pipeline stages" },
  { module: "interview", action: "schedule", key: "interview.schedule",description: "Schedule, update, and cancel interview slots" },
  { module: "interview", action: "feedback", key: "interview.feedback",description: "Submit interview evaluations, complete sessions, and manage skills" },

  // ── Offers & Onboarding ──────────────────────────────────────────────────────
  { module: "offer",      action: "create", key: "offer.create",     description: "Generate offer letters for candidates" },
  { module: "offer",      action: "approve",key: "offer.approve",    description: "Approve or reject pending offer letters" },
  { module: "onboarding", action: "read",   key: "onboarding.read",  description: "View onboarding progression for all employees" },
  { module: "onboarding", action: "manage", key: "onboarding.manage",description: "Manage onboarding tasks and checklists" },
  // Self-service: employees see their own onboarding/probation status
  { module: "onboarding", action: "self",   key: "onboarding.self",  description: "View own onboarding progress, contract, and checklists" },

  // ── HR & Employee Management ─────────────────────────────────────────────────
  { module: "hr",         action: "read",   key: "hr.read",          description: "View all employee records" },
  { module: "hr",         action: "write",  key: "hr.write",         description: "Create and update employee data and contracts" },
  { module: "profiles",   action: "read",   key: "profiles.read",    description: "Access the employee directory, organogram, and events" },
  { module: "profiles",   action: "self",   key: "profiles.self",    description: "View upcoming company events, own profile, and directory" },
  { module: "department", action: "create", key: "department.create",description: "Create departments" },
  { module: "department", action: "update", key: "department.update",description: "Update departments" },
  { module: "department", action: "delete", key: "department.delete",description: "Delete departments" },
  { module: "position",   action: "create", key: "position.create",  description: "Create positions" },
  { module: "position",   action: "update", key: "position.update",  description: "Update positions" },
  { module: "position",   action: "delete", key: "position.delete",  description: "Delete positions" },
  { module: "device",     action: "read",   key: "device.read",      description: "View employee registered devices" },
  { module: "device",     action: "approve",key: "device.approve",   description: "Approve or reject employee device registrations" },

  // ── CRM & Projects ───────────────────────────────────────────────────────────
  { module: "crm",     action: "read",   key: "crm.read",     description: "View leads and customers" },
  { module: "crm",     action: "manage", key: "crm.manage",   description: "Manage sales deals and accounts" },
  { module: "project", action: "read",   key: "project.read", description: "View project dashboards" },
  { module: "project", action: "self",   key: "project.self", description: "View projects and tasks assigned to self" },
  { module: "project", action: "create", key: "project.create",description: "Create new projects" },
  { module: "project", action: "task",   key: "project.task", description: "Create and move project tasks" },
  { module: "project", action: "manage", key: "project.manage",description: "Manage projects, tasks, members, and timelines" },

  // ── Finance & Operations ─────────────────────────────────────────────────────
  { module: "finance", action: "read",   key: "finance.read",  description: "View financial reports and workforce finance dashboard" },
  { module: "finance", action: "manage", key: "finance.manage",description: "Process invoices, approve expenses, and manage budgets" },
  { module: "finance", action: "salary_employee_read", key: "salary_employee_read", description: "View and recalculate employee salary records" },
  // Self-service: employee sees only their own payslip, salary, and benefits
  { module: "finance", action: "mine",   key: "finance.mine",  description: "View own salary, payslips, and submit expense claims" },
  { module: "payroll", action: "read",   key: "payroll.read",  description: "View payroll history and salary data" },
  { module: "payroll", action: "run",    key: "payroll.run",   description: "Execute payroll cycles" },
  { module: "budget",  action: "read",   key: "budget.read",   description: "View department and company budget allocations" },
  // Self-service: any employee can submit expenses and see their own benefits
  { module: "expense",  action: "submit",key: "expense.submit", description: "Submit own expense claims for reimbursement" },
  { module: "benefits", action: "read",  key: "benefits.read",  description: "View own employee benefits and entitlements" },

  // ── Attendance & Time ────────────────────────────────────────────────────────
  { module: "attendance", action: "read",   key: "attendance.read",  description: "View attendance logs and timesheets for all staff" },
  { module: "attendance", action: "manage", key: "attendance.manage",description: "Adjust timesheets, manage shifts, and review late reasons" },
  { module: "attendance", action: "late_reason.read", key: "attendance.late_reason.read", description: "View active late check-in reasons" },
  { module: "attendance", action: "checkin_correction.request", key: "attendance.checkin_correction.request", description: "Submit manual check-in/out correction requests for approval" },
  { module: "attendance", action: "checkin_correction.approve", key: "attendance.checkin_correction.approve", description: "Approve or reject manual check-in/out corrections" },
  // Self-service: employees check themselves in and manage their own requests
  { module: "attendance", action: "self",   key: "attendance.self",  description: "Self check-in, view own history, and submit attendance requests" },
  { module: "leave",      action: "read",   key: "leave.read",       description: "View leave balances and requests" },
  { module: "leave",      action: "approve",key: "leave.approve",    description: "Approve or deny leave, overtime, and WFH requests" },
  { module: "leave",      action: "manage", key: "leave.manage",     description: "Create and manage leave templates and types" },
  { module: "leave",      action: "self_department_read",   key: "self_department_leave_read",   description: "View leave requests for employees in own department" },
  { module: "leave",      action: "self_department_manage", key: "self_department_leave_manage", description: "Approve or reject leave requests for employees in own department" },

  // ── Performance & Growth ─────────────────────────────────────────────────────
  { module: "performance", action: "read",   key: "performance.read",  description: "View performance metrics, KPIs, and review cycles" },
  { module: "performance", action: "manage", key: "performance.manage",description: "Conduct appraisals, set OKRs, manage discipline" },
  // Self-service: employees view and update their own OKRs and participate in reviews
  { module: "performance", action: "self",   key: "performance.self",  description: "View own performance reviews, set personal OKRs, fill in evaluation forms" },

  // ── Career & Exit ────────────────────────────────────────────────────────────
  // Self-service: employees view career path, request training, submit resignation
  { module: "career", action: "self",    key: "career.self",    description: "View own career path, request training, and access culture content" },
  { module: "career", action: "request", key: "career.request", description: "Submit training and promotion requests for self" },
  { module: "exit",   action: "self",    key: "exit.self",      description: "Submit resignation, track own clearance checklist, and access exit documents" },

  // ── System Administration ─────────────────────────────────────────────────────
  { module: "settings", action: "read",   key: "settings.read",  description: "View company settings and configuration" },
  { module: "settings", action: "update", key: "settings.update",description: "Update company branding and configuration" },
  { module: "module",   action: "manage", key: "module.manage",  description: "Enable or disable ERP modules for a business tenant" },

  // ── Brain Knowledge Base & Documentation ────────────────────────────────────
  { module: "brain", action: "access",           key: "brain.access",           description: "Access Brain module" },
  { module: "brain", action: "category_view",    key: "brain.category.view",    description: "View knowledge categories" },
  { module: "brain", action: "category_create",  key: "brain.category.create",  description: "Create knowledge categories" },
  { module: "brain", action: "category_update",  key: "brain.category.update",  description: "Update knowledge categories" },
  { module: "brain", action: "category_delete",  key: "brain.category.delete",  description: "Delete knowledge categories" },
  { module: "brain", action: "category_restore", key: "brain.category.restore", description: "Restore deleted knowledge categories" },
  { module: "brain", action: "article_view",     key: "brain.article.view",     description: "View knowledge articles" },
  { module: "brain", action: "article_create",   key: "brain.article.create",   description: "Create knowledge articles" },
  { module: "brain", action: "article_update_own", key: "brain.article.update_own", description: "Update own draft knowledge articles" },
  { module: "brain", action: "article_update_any", key: "brain.article.update_any", description: "Update any knowledge articles" },
  { module: "brain", action: "article_delete",   key: "brain.article.delete",   description: "Delete knowledge articles" },
  { module: "brain", action: "article_restore",  key: "brain.article.restore",  description: "Restore deleted knowledge articles" },
  { module: "brain", action: "article_submit_review", key: "brain.article.submit_review", description: "Submit articles for review" },
  { module: "brain", action: "article_review",   key: "brain.article.review",   description: "Review and approve/request changes on articles" },
  { module: "brain", action: "article_publish",  key: "brain.article.publish",  description: "Publish or unpublish knowledge articles" },
  { module: "brain", action: "article_archive",  key: "brain.article.archive",  description: "Archive knowledge articles" },
  { module: "brain", action: "article_view_revisions", key: "brain.article.view_revisions", description: "View article revision history" },
  { module: "brain", action: "article_restore_revision", key: "brain.article.restore_revision", description: "Restore an article revision" },
  { module: "brain", action: "training_view",    key: "brain.training.view",    description: "View training materials" },
  { module: "brain", action: "training_create",  key: "brain.training.create",  description: "Create training materials" },
  { module: "brain", action: "training_update",  key: "brain.training.update",  description: "Update training materials" },
  { module: "brain", action: "training_delete",  key: "brain.training.delete",  description: "Delete training materials" },

  // ── Policy & Governance ──────────────────────────────────────────────────
  { module: "policy", action: "access",           key: "policy.access",           description: "Access Policy module" },

  { module: "policy", action: "category_view",    key: "policy.category.view",    description: "View policy categories" },
  { module: "policy", action: "category_create",  key: "policy.category.create",  description: "Create policy categories" },
  { module: "policy", action: "category_update",  key: "policy.category.update",  description: "Update policy categories" },
  { module: "policy", action: "category_delete",  key: "policy.category.delete",  description: "Delete policy categories" },
  { module: "policy", action: "category_restore", key: "policy.category.restore", description: "Restore deleted policy categories" },

  { module: "policy", action: "document_view",          key: "policy.document.view",          description: "View policy documents" },
  { module: "policy", action: "document_create",        key: "policy.document.create",        description: "Create policy documents" },
  { module: "policy", action: "document_update_own",    key: "policy.document.update_own",    description: "Update own draft policy documents" },
  { module: "policy", action: "document_update_any",    key: "policy.document.update_any",    description: "Update any policy document" },
  { module: "policy", action: "document_delete",        key: "policy.document.delete",        description: "Delete policy documents" },
  { module: "policy", action: "document_restore",       key: "policy.document.restore",       description: "Restore deleted policy documents" },
  { module: "policy", action: "document_submit_review", key: "policy.document.submit_review", description: "Submit policy documents for review" },
  { module: "policy", action: "document_review",        key: "policy.document.review",        description: "Review and request changes on policy documents" },
  { module: "policy", action: "document_approve",       key: "policy.document.approve",       description: "Approve policy documents" },
  { module: "policy", action: "document_schedule",      key: "policy.document.schedule",      description: "Schedule policy documents for future publication" },
  { module: "policy", action: "document_publish",       key: "policy.document.publish",       description: "Publish or unpublish policy documents" },
  { module: "policy", action: "document_unpublish",     key: "policy.document.unpublish",     description: "Unpublish published policy documents" },
  { module: "policy", action: "document_supersede",     key: "policy.document.supersede",     description: "Supersede policy documents" },
  { module: "policy", action: "document_archive",       key: "policy.document.archive",       description: "Archive policy documents" },
  { module: "policy", action: "document_view_versions", key: "policy.document.view_versions", description: "View policy version history" },
  { module: "policy", action: "document_restore_version", key: "policy.document.restore_version", description: "Restore a policy version" },

  { module: "policy", action: "assignment_view",   key: "policy.assignment.view",   description: "View policy assignments" },
  { module: "policy", action: "assignment_manage", key: "policy.assignment.manage", description: "Manage policy assignments" },

  { module: "policy", action: "acceptance_view_own", key: "policy.acceptance.view_own", description: "View own policy acceptances" },
  { module: "policy", action: "acceptance_accept",   key: "policy.acceptance.accept",   description: "Accept policy obligations" },
  { module: "policy", action: "acceptance_sign",     key: "policy.acceptance.sign",     description: "Sign policy obligations" },
  { module: "policy", action: "acceptance_view_team", key: "policy.acceptance.view_team", description: "View team policy acceptances" },
  { module: "policy", action: "acceptance_view_all", key: "policy.acceptance.view_all", description: "View all policy acceptances" },
  { module: "policy", action: "acceptance_export",   key: "policy.acceptance.export",   description: "Export policy acceptance reports" },

  { module: "policy", action: "public_share_manage", key: "policy.public_share.manage", description: "Manage public policy sharing tokens" },
  { module: "policy", action: "audit_view",          key: "policy.audit.view",          description: "View policy audit logs" },
  { module: "policy", action: "settings_manage",     key: "policy.settings.manage",     description: "Manage policy settings" },

  // ── Company Procedures ────────────────────────────────────────────────────────
  { module: "procedures", action: "access",           key: "procedures.access",           description: "Access Company Procedures module" },
  { module: "procedures", action: "procedure_view",    key: "procedures.procedure.view",    description: "View procedures" },
  { module: "procedures", action: "procedure_create",  key: "procedures.procedure.create",  description: "Create procedures" },
  { module: "procedures", action: "procedure_update_own", key: "procedures.procedure.update_own", description: "Update own draft procedures" },
  { module: "procedures", action: "procedure_update_any", key: "procedures.procedure.update_any", description: "Update any procedures" },
  { module: "procedures", action: "procedure_delete",  key: "procedures.procedure.delete",  description: "Delete procedures" },
  { module: "procedures", action: "procedure_restore", key: "procedures.procedure.restore", description: "Restore deleted procedures" },
  { module: "procedures", action: "procedure_submit_review", key: "procedures.procedure.submit_review", description: "Submit procedures for review" },
  { module: "procedures", action: "procedure_review",   key: "procedures.procedure.review",   description: "Review and approve/request changes on procedures" },
  { module: "procedures", action: "procedure_publish",  key: "procedures.procedure.publish",  description: "Publish or unpublish procedures" },
  { module: "procedures", action: "procedure_archive",  key: "procedures.procedure.archive",  description: "Archive procedures" },
  { module: "procedures", action: "procedure_view_revisions", key: "procedures.procedure.view_revisions", description: "View procedure revision history" },
  { module: "procedures", action: "procedure_restore_revision", key: "procedures.procedure.restore_revision", description: "Restore a procedure revision" },
];
