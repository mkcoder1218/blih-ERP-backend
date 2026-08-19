type PermissionLike = {
  key: string;
  module: string;
  action: string;
  description?: string | null;
};

export type PermissionMetadata = {
  title: string;
  moduleTitle: string;
  sortOrder: number;
  dependencies: string[];
};

const MODULE_TITLES: Record<string, string> = {
  applicant: "Recruitment",
  interview: "Recruitment",
  job: "Recruitment",
  job_template: "Recruitment",
  offer: "Recruitment",
  onboarding: "Onboarding",
  profiles: "People & Profiles",
  profile: "People & Profiles",
  department: "People & Profiles",
  position: "People & Profiles",
  device: "People & Profiles",
  attendance: "Attendance & Leave",
  leave: "Attendance & Leave",
  overtime: "Attendance & Leave",
  performance: "Performance",
  career: "Career Management",
  exit: "Exit & Offboarding",
  finance: "Workforce Finance",
  benefits: "Workforce Finance",
  salary_employee: "Workforce Finance",
  project: "Projects",
  projects: "Projects",
  brain: "Brain",
  procedures: "Procedures",
  procedure: "Procedures",
  policy: "Policies",
  settings: "Settings",
  module: "Settings",
  role: "Roles & Permissions",
  permission: "Roles & Permissions",
  user: "Users",
  business: "Businesses",
  audit: "Audit & Security",
  audit_log: "Audit & Security",
  notification: "Notifications",
  inventory: "Inventory",
  crm: "CRM",
};

const MODULE_ORDER = [
  "Recruitment",
  "Onboarding",
  "People & Profiles",
  "Attendance & Leave",
  "Performance",
  "Career Management",
  "Exit & Offboarding",
  "Workforce Finance",
  "Projects",
  "Brain",
  "Procedures",
  "Policies",
  "CRM",
  "Inventory",
  "Users",
  "Roles & Permissions",
  "Settings",
  "Businesses",
  "Notifications",
  "Audit & Security",
];

const ACTION_ORDER: Record<string, number> = {
  access: 10,
  read: 20,
  view: 20,
  self: 25,
  create: 30,
  request: 35,
  update: 40,
  write: 40,
  manage: 50,
  assign: 55,
  approve: 60,
  review: 65,
  publish: 70,
  archive: 80,
  restore: 85,
  delete: 90,
};

const ACTION_LABELS: Record<string, string> = {
  access: "Access",
  read: "View",
  view: "View",
  self: "Use own",
  create: "Create",
  request: "Request",
  update: "Update",
  write: "Manage",
  manage: "Manage",
  assign: "Assign",
  approve: "Approve",
  review: "Review",
  publish: "Publish",
  archive: "Archive",
  restore: "Restore",
  delete: "Delete",
};

function humanize(value: string) {
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function entityFromKey(permission: PermissionLike) {
  const parts = permission.key.split(".");
  if (parts.length <= 2) return humanize(permission.module);
  return humanize(parts.slice(1, -1).join(" "));
}

function titleFor(permission: PermissionLike) {
  const parts = permission.key.split(".");
  const action = parts[parts.length - 1] || permission.action;
  const label = ACTION_LABELS[action] || humanize(action);
  const entity = entityFromKey(permission);
  return entity ? `${label} ${entity}` : label;
}

function moduleTitleFor(permission: PermissionLike) {
  const root = permission.key.split(".")[0] || permission.module;
  return MODULE_TITLES[permission.module] || MODULE_TITLES[root] || humanize(permission.module || root);
}

function inferDependencies(permission: PermissionLike, allKeys: Set<string>) {
  const dependencies = new Set<string>();
  const parts = permission.key.split(".");
  const root = parts[0];
  const action = parts[parts.length - 1];

  const rootRead = `${root}.read`;
  if (
    ["create", "update", "delete", "archive", "restore", "approve", "review", "publish", "manage", "assign"].includes(action) &&
    allKeys.has(rootRead) &&
    rootRead !== permission.key
  ) {
    dependencies.add(rootRead);
  }

  if (root === "brain" && permission.key !== "brain.access" && allKeys.has("brain.access")) {
    dependencies.add("brain.access");
  }
  if (root === "policy" && permission.key !== "policy.access" && allKeys.has("policy.access")) {
    dependencies.add("policy.access");
  }
  if ((root === "procedures" || root === "procedure") && permission.key !== "procedures.access" && allKeys.has("procedures.access")) {
    dependencies.add("procedures.access");
  }

  const parentEntity = parts.length > 2 ? parts.slice(0, -1).join(".") : null;
  if (parentEntity) {
    const parentView = `${parentEntity}.view`;
    const parentRead = `${parentEntity}.read`;
    if (action !== "view" && allKeys.has(parentView)) dependencies.add(parentView);
    else if (action !== "read" && allKeys.has(parentRead)) dependencies.add(parentRead);
  }

  const explicit: Record<string, string[]> = {
    "settings.update": ["settings.read"],
    "role.create": ["role.read"],
    "role.update": ["role.read"],
    "role.delete": ["role.read"],
    "project.manage": ["project.read"],
    "project.create": ["project.read"],
    "attendance.manage": ["attendance.read"],
    "finance.manage": ["finance.read"],
    "performance.manage": ["performance.read"],
  };

  for (const key of explicit[permission.key] || []) {
    if (allKeys.has(key)) dependencies.add(key);
  }

  return Array.from(dependencies);
}

export function buildPermissionMetadata(permission: PermissionLike, allKeys: Set<string>): PermissionMetadata {
  const moduleTitle = moduleTitleFor(permission);
  const action = permission.key.split(".").pop() || permission.action;
  const moduleIndex = MODULE_ORDER.indexOf(moduleTitle);
  const moduleWeight = moduleIndex === -1 ? 900 : moduleIndex * 100;
  const actionWeight = ACTION_ORDER[action] ?? 75;

  return {
    title: titleFor(permission),
    moduleTitle,
    sortOrder: moduleWeight + actionWeight,
    dependencies: inferDependencies(permission, allKeys),
  };
}

export function expandPermissionDependencies(keys: string[], permissions: PermissionLike[]) {
  const byKey = new Map(permissions.map((permission) => [permission.key, permission]));
  const allKeys = new Set(byKey.keys());
  const expanded = new Set(keys.filter((key) => allKeys.has(key)));
  const queue = Array.from(expanded);

  while (queue.length) {
    const key = queue.shift()!;
    const permission = byKey.get(key);
    if (!permission) continue;
    for (const dependency of buildPermissionMetadata(permission, allKeys).dependencies) {
      if (!expanded.has(dependency)) {
        expanded.add(dependency);
        queue.push(dependency);
      }
    }
  }

  return Array.from(expanded);
}
