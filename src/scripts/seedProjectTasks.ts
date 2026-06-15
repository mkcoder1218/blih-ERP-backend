import { db } from "../models";

const TASK_COUNT = Number(process.env.TASK_SEED_COUNT || 100);
const SEED_BATCH = process.env.TASK_SEED_BATCH || "project-management-virtualization";

const STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const TASK_TITLES = [
  "Draft client onboarding checklist",
  "Review project kickoff notes",
  "Prepare stakeholder update",
  "Validate dashboard permissions",
  "Document acceptance criteria",
  "Create QA test cases",
  "Refine implementation timeline",
  "Check integration requirements",
  "Update delivery risk log",
  "Confirm deployment checklist",
  "Review feedback from sponsor",
  "Prepare handoff notes",
  "Clean up board labels",
  "Test task status movement",
  "Verify assignee filtering",
  "Run workflow smoke test",
  "Update milestone summary",
  "Confirm release readiness",
  "Review blocked work items",
  "Archive completed follow-ups",
];

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

async function getSeedBusiness() {
  const businessId = process.env.TASK_SEED_BUSINESS_ID;
  if (businessId) {
    const business = await db.Business.findByPk(businessId);
    if (!business) throw new Error(`Business not found for TASK_SEED_BUSINESS_ID=${businessId}`);
    return business;
  }

  const business = await db.Business.findOne({ order: [["createdAt", "ASC"]] });
  if (!business) throw new Error("No business found. Create a business before seeding project tasks.");
  return business;
}

async function getSeedProject(businessId: string) {
  const projectId = process.env.TASK_SEED_PROJECT_ID;
  if (projectId) {
    const project = await db.Project.findOne({ where: { id: projectId, businessId } });
    if (!project) throw new Error(`Project not found for TASK_SEED_PROJECT_ID=${projectId}`);
    return project;
  }

  const existing = await db.Project.findOne({ where: { businessId }, order: [["createdAt", "DESC"]] });
  if (existing) return existing;

  return db.Project.create({
    businessId,
    title: "Project Management Test Board",
    code: "PRJ-SEED",
    type: "standard",
    description: "Seed project for task board testing.",
    startDate: addDays(new Date(), -7),
    endDate: addDays(new Date(), 45),
    priority: "HIGH",
    status: "ACTIVE",
    metadata: { seedBatch: SEED_BATCH },
  });
}

async function run() {
  await db.sequelize.authenticate();

  const business = await getSeedBusiness();
  const businessId = business.id;
  const project = await getSeedProject(businessId);
  const employees = await db.EmployeeRecord.findAll({
    where: { businessId },
    order: [["createdAt", "ASC"]],
  });

  const existing = await db.ProjectTask.count({
    where: {
      businessId,
      projectId: project.id,
      metadata: { seedBatch: SEED_BATCH },
    },
  });

  if (existing >= TASK_COUNT) {
    console.log(`Seed already has ${existing} tasks for project ${project.title}. Nothing to add.`);
    return;
  }

  const now = new Date();
  const rows = Array.from({ length: TASK_COUNT - existing }, (_, index) => {
    const number = existing + index + 1;
    const assignee = employees.length ? employees[number % employees.length] : null;
    const status = STATUSES[number % STATUSES.length];
    const priority = PRIORITIES[number % PRIORITIES.length];

    return {
      businessId,
      projectId: project.id,
      assigneeEmployeeId: assignee?.id ?? null,
      assignedToUserId: assignee?.userId ?? null,
      code: `SEED-T-${String(number).padStart(4, "0")}`,
      title: `${TASK_TITLES[number % TASK_TITLES.length]} #${number}`,
      description: "Generated task for testing the project management board, filters, counts, and virtualized columns.",
      priority,
      status,
      startDate: addDays(now, -Math.floor(number / 3)),
      dueDate: addDays(now, (number % 30) + 1),
      weight: (number % 5) + 1,
      estimatedHours: 2 + (number % 12),
      actualHours: status === "DONE" ? 1 + (number % 10) : 0,
      metadata: {
        seedBatch: SEED_BATCH,
        seedIndex: number,
      },
    };
  });

  await db.ProjectTask.bulkCreate(rows);

  const totalSeeded = existing + rows.length;
  const completed = await db.ProjectTask.count({
    where: {
      businessId,
      projectId: project.id,
      status: "DONE",
      metadata: { seedBatch: SEED_BATCH },
    },
  });

  await project.update({
    status: "ACTIVE",
    progressPercent: Math.round((completed / totalSeeded) * 100),
    metadata: {
      ...(project.metadata ?? {}),
      seedBatch: project.metadata?.seedBatch ?? SEED_BATCH,
      progress: {
        totalTasks: totalSeeded,
        completedTasks: completed,
        progressPercent: Math.round((completed / totalSeeded) * 100),
      },
    },
  });

  console.log(`Created ${rows.length} project tasks.`);
  console.log(`Project: ${project.title} (${project.id})`);
  console.log(`Business: ${business.name ?? business.id}`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.sequelize.close();
  });
