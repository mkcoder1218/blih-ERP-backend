import { Op } from "sequelize";
import { db } from "../../models";

type Interval = "weekly" | "monthly" | "quarterly" | "yearly";
type AnalyticsStatus = "not_started" | "in_progress" | "blocked" | "overdue" | "completed";

interface AnalyticsQuery {
  dateFrom?: string;
  dateTo?: string;
  departmentId?: string;
  managerId?: string;
  status?: string;
  search?: string;
  interval?: string;
  attentionPage?: string;
  activePage?: string;
  pageSize?: string;
}

const COMPLETED_TASK_STATUSES = new Set(["completed", "done", "approved", "finalized"]);
const BLOCKED_TASK_STATUSES = new Set(["blocked", "on_hold", "on hold"]);
const COMPLETED_REVIEW_STATUSES = new Set(["reviewed", "acknowledged", "finalized", "completed"]);
const TERMINATED_EMPLOYMENT_STATUSES = new Set(["terminated", "inactive", "cancelled"]);
const DAY_MS = 86_400_000;

const asArray = (value: unknown): any[] => Array.isArray(value) ? value : [];
const asObject = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.ceil((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS));
}

function average(values: number[], precision = 1) {
  if (!values.length) return 0;
  const factor = 10 ** precision;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * factor) / factor;
}

function within(date: Date | null, from: Date | null, to: Date | null) {
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function normalizedStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function sectionIsComplete(section: string, onboarding: any) {
  if (onboarding.status === "COMPLETED") return true;
  const data = asObject(onboarding.candidateData);
  if (section === "overview") return true;
  if (section === "documents") {
    const documents = asArray(onboarding.requiredDocuments).filter((item) => item?.required !== false);
    const documentData = asObject(data.documents);
    return documents.every((_, index) => Boolean(documentData[`doc_${index}`]?.fileId));
  }
  if (section === "policies") {
    const policies = asArray(onboarding.requiredPolicies).filter((item) => item?.required !== false);
    const policyData = asObject(data.policies);
    return policies.every((_, index) => Boolean(policyData[`policy_${index}`]));
  }
  if (section === "resources") {
    const resources = asArray(onboarding.resources);
    const responses = asArray(onboarding.resourceResponses);
    return resources.every((resource, index) => resource?.acceptanceRequired === false || responses.some((response) => response?.resourceIndex === index && response?.status));
  }
  const sectionData = asObject(data[section]);
  return Object.keys(sectionData).length > 0;
}

function workflowStats(onboarding: any, expectedCompletion: Date | null, now: Date) {
  const sections = asArray(onboarding.sections).filter((section) => typeof section === "string" && section !== "review");
  const completed = sections.filter((section) => sectionIsComplete(section, onboarding)).length;
  const correctionRequested = asArray(onboarding.resourceResponses).some((response) => response?.status === "correction_requested");
  const blocked = correctionRequested && completed < sections.length ? 1 : 0;
  const overdue = expectedCompletion && expectedCompletion < now && completed < sections.length
    ? Math.max(0, sections.length - completed - blocked)
    : 0;
  const pending = Math.max(0, sections.length - completed - blocked - overdue);
  return { required: sections.length, completed, pending, overdue, blocked };
}

function databaseTaskStats(tasks: any[], now: Date) {
  return tasks.reduce((totals, task) => {
    const status = normalizedStatus(task.status);
    totals.required += 1;
    if (COMPLETED_TASK_STATUSES.has(status)) totals.completed += 1;
    else if (BLOCKED_TASK_STATUSES.has(status)) totals.blocked += 1;
    else if (asDate(task.dueDate) && asDate(task.dueDate)! < now) totals.overdue += 1;
    else totals.pending += 1;
    return totals;
  }, { required: 0, completed: 0, pending: 0, overdue: 0, blocked: 0 });
}

function combineTaskStats(...groups: Array<{ required: number; completed: number; pending: number; overdue: number; blocked: number }>) {
  return groups.reduce((total, group) => ({
    required: total.required + group.required,
    completed: total.completed + group.completed,
    pending: total.pending + group.pending,
    overdue: total.overdue + group.overdue,
    blocked: total.blocked + group.blocked,
  }), { required: 0, completed: 0, pending: 0, overdue: 0, blocked: 0 });
}

function startOfBucket(date: Date, interval: Interval) {
  const result = startOfDay(date);
  if (interval === "weekly") {
    const day = result.getDay();
    result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  } else if (interval === "monthly") {
    result.setDate(1);
  } else if (interval === "quarterly") {
    result.setMonth(Math.floor(result.getMonth() / 3) * 3, 1);
  } else {
    result.setMonth(0, 1);
  }
  return result;
}

function nextBucket(date: Date, interval: Interval) {
  const result = new Date(date);
  if (interval === "weekly") result.setDate(result.getDate() + 7);
  if (interval === "monthly") result.setMonth(result.getMonth() + 1);
  if (interval === "quarterly") result.setMonth(result.getMonth() + 3);
  if (interval === "yearly") result.setFullYear(result.getFullYear() + 1);
  return result;
}

function bucketLabel(date: Date, interval: Interval) {
  if (interval === "yearly") return String(date.getFullYear());
  if (interval === "quarterly") return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  if (interval === "monthly") return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function paginate<T>(rows: T[], page: number, size: number) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return { rows: rows.slice((safePage - 1) * size, safePage * size), total, page: safePage, pageSize: size, totalPages };
}

export class OnboardingAnalyticsService {
  async getAnalytics(businessId: string, query: AnalyticsQuery) {
    const now = new Date();
    const from = query.dateFrom ? startOfDay(asDate(query.dateFrom) || now) : null;
    const to = query.dateTo ? endOfDay(asDate(query.dateTo) || now) : null;
    const interval = (["weekly", "monthly", "quarterly", "yearly"].includes(String(query.interval)) ? query.interval : "monthly") as Interval;
    const pageSize = Math.min(50, Math.max(5, Number(query.pageSize) || 10));
    const attentionPage = Math.max(1, Number(query.attentionPage) || 1);
    const activePage = Math.max(1, Number(query.activePage) || 1);

    const [onboardings, offers, employeeRecords, tasks, departments, positions, users, probationReviews] = await Promise.all([
      db.CandidateOnboarding.findAll({ where: { businessId }, order: [["createdAt", "DESC"]] }),
      db.OfferLetter.findAll({ where: { businessId }, attributes: ["id", "departmentId", "positionId", "reportingManagerId", "reportingManager", "startDate", "createdById"] }),
      db.EmployeeRecord.findAll({ where: { businessId }, attributes: ["id", "userId", "departmentId", "positionId", "managerUserId", "employmentStatus", "hireDate", "probationEndDate"] }),
      db.OnboardingTask.findAll({ where: { businessId }, attributes: ["id", "employeeUserId", "assignedToUserId", "title", "dueDate", "status", "metadata"] }),
      db.Department.findAll({ where: { businessId }, attributes: ["id", "name"] }),
      db.Position.findAll({ where: { businessId }, attributes: ["id", "title", "departmentId"] }),
      db.User.findAll({ where: { businessId }, attributes: ["id", "fullName", "email", "status"] }),
      db.PerformanceReview.findAll({ where: { businessId, periodType: { [Op.iLike]: "probation" } }, attributes: ["id", "employeeUserId", "reviewerUserId", "periodEnd", "status"] }),
    ]);

    const offerById = new Map<string, any>(offers.map((row: any) => [String(row.id), row]));
    const departmentById = new Map<string, string>(departments.map((row: any) => [String(row.id), row.name]));
    const positionById = new Map<string, string>(positions.map((row: any) => [String(row.id), row.title]));
    const userById = new Map<string, any>(users.map((row: any) => [String(row.id), row]));
    const userByEmail = new Map<string, any>(users.map((row: any) => [String(row.email || "").toLowerCase(), row]));
    const recordByUserId = new Map<string, any>(employeeRecords.map((row: any) => [String(row.userId), row]));
    const tasksByUserId = new Map<string, any[]>();
    tasks.forEach((task: any) => {
      const key = String(task.employeeUserId);
      tasksByUserId.set(key, [...(tasksByUserId.get(key) || []), task]);
    });

    const allRows = onboardings
      .filter((onboarding: any) => onboarding.status !== "CANCELLED")
      .map((onboarding: any) => {
        const offer: any = offerById.get(String(onboarding.offerId));
        const employee: any = userByEmail.get(String(onboarding.candidateEmail || "").toLowerCase());
        const record: any = employee ? recordByUserId.get(String(employee.id)) : null;
        const employeeTasks = employee ? tasksByUserId.get(String(employee.id)) || [] : [];
        const metadata = asObject(onboarding.metadata);
        const startDate = asDate(offer?.startDate || metadata.startDate || onboarding.createdAt);
        const taskDueDates = employeeTasks.map((task: any) => asDate(task.dueDate)).filter(Boolean) as Date[];
        const expectedCompletion = asDate(metadata.expiresAt) || (taskDueDates.length ? new Date(Math.max(...taskDueDates.map((date) => date.getTime()))) : null);
        const completionDate = onboarding.completedAt ? asDate(onboarding.completedAt) : onboarding.status === "COMPLETED" ? asDate(onboarding.updatedAt) : null;
        const managerId = offer?.reportingManagerId || record?.managerUserId || null;
        const manager = managerId ? userById.get(String(managerId)) : null;
        const initializer = onboarding.initializedById ? userById.get(String(onboarding.initializedById)) : null;
        const departmentId = offer?.departmentId || record?.departmentId || null;
        const positionId = offer?.positionId || record?.positionId || null;
        const departmentName = departmentId ? departmentById.get(String(departmentId)) || null : null;
        const managerName = manager?.fullName || offer?.reportingManager || null;
        const workflow = workflowStats(onboarding, expectedCompletion, now);
        const databaseTasks = databaseTaskStats(employeeTasks, now);
        const taskStats = combineTaskStats(workflow, databaseTasks);
        const isCompleted = onboarding.status === "COMPLETED";
        const isOverdue = !isCompleted && Boolean(expectedCompletion && expectedCompletion < now);
        const isBlocked = !isCompleted && taskStats.blocked > 0;
        const status: AnalyticsStatus = isCompleted
          ? "completed"
          : isBlocked
            ? "blocked"
            : isOverdue
              ? "overdue"
              : Number(onboarding.progress || 0) === 0
                ? "not_started"
                : "in_progress";

        const requiredDocuments = asArray(onboarding.requiredDocuments).filter((document) => document?.required !== false);
        const documentData = asObject(asObject(onboarding.candidateData).documents);
        const missingDocuments = requiredDocuments.filter((_, index) => !documentData[`doc_${index}`]?.fileId).length;
        const blockedTask = employeeTasks.find((task: any) => BLOCKED_TASK_STATUSES.has(normalizedStatus(task.status)));
        const overdueTask = employeeTasks.find((task: any) => !COMPLETED_TASK_STATUSES.has(normalizedStatus(task.status)) && asDate(task.dueDate) && asDate(task.dueDate)! < now);
        const delayedApproval = onboarding.status === "SUBMITTED_FOR_REVIEW" && isOverdue;
        let issue: { label: string; responsiblePerson: string | null; dueDate: Date | null } | null = null;
        if (blockedTask) issue = { label: `Blocked task: ${blockedTask.title}`, responsiblePerson: userById.get(String(blockedTask.assignedToUserId))?.fullName || managerName, dueDate: asDate(blockedTask.dueDate) };
        else if (overdueTask) issue = { label: `Overdue task: ${overdueTask.title}`, responsiblePerson: userById.get(String(overdueTask.assignedToUserId))?.fullName || managerName, dueDate: asDate(overdueTask.dueDate) };
        else if (delayedApproval) issue = { label: "Delayed approval", responsiblePerson: initializer?.fullName || managerName, dueDate: expectedCompletion };
        else if (missingDocuments > 0) issue = { label: `${missingDocuments} required document${missingDocuments === 1 ? "" : "s"} missing`, responsiblePerson: onboarding.candidateName, dueDate: expectedCompletion };
        else if (asArray(onboarding.sections).length === 0) issue = { label: "Missing checklist", responsiblePerson: initializer?.fullName || null, dueDate: expectedCompletion };
        else if (!managerName) issue = { label: "Missing manager", responsiblePerson: initializer?.fullName || null, dueDate: expectedCompletion };
        else if (onboarding.status === "SUBMITTED_FOR_REVIEW") issue = { label: "Approval pending", responsiblePerson: initializer?.fullName || managerName, dueDate: expectedCompletion };
        else if (isOverdue) issue = { label: "Onboarding overdue", responsiblePerson: managerName || initializer?.fullName || null, dueDate: expectedCompletion };

        const incompleteSections = asArray(onboarding.sections).filter((section) => section !== "review" && !sectionIsComplete(section, onboarding));
        const currentStage = isCompleted
          ? "Completed"
          : onboarding.status === "SUBMITTED_FOR_REVIEW"
            ? "Approval review"
            : incompleteSections.length
              ? String(incompleteSections[0]).replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
              : "Final review";

        return {
          id: onboarding.id,
          onboardingId: onboarding.onboardingId,
          employee: onboarding.candidateName,
          email: onboarding.candidateEmail,
          position: positionId ? positionById.get(String(positionId)) || null : metadata.positionTitle || metadata.position || null,
          departmentId,
          department: departmentName,
          managerId,
          manager: managerName,
          startDate,
          completionDate,
          expectedCompletion,
          initializedAt: asDate(onboarding.createdAt),
          submittedAt: asDate(onboarding.submittedAt),
          progress: Math.max(0, Math.min(100, Number(onboarding.progress || 0))),
          status,
          sourceStatus: onboarding.status,
          currentStage,
          taskStats,
          issue,
          daysOverdue: issue?.dueDate && issue.dueDate < now ? daysBetween(issue.dueDate, now) : 0,
        };
      });

    const search = String(query.search || "").trim().toLowerCase();
    const dimensionRows = allRows.filter((row) => {
      if (query.departmentId && String(row.departmentId || "") !== query.departmentId) return false;
      if (query.managerId && String(row.managerId || "") !== query.managerId) return false;
      if (query.status && query.status !== "all" && row.status !== query.status) return false;
      if (search && !`${row.employee} ${row.email} ${row.department || ""} ${row.position || ""}`.toLowerCase().includes(search)) return false;
      return true;
    });
    const filteredRows = dimensionRows.filter((row) => !from && !to ? true : within(row.startDate, from, to));
    const activeRows = filteredRows.filter((row) => row.status !== "completed");
    const completedRows = filteredRows.filter((row) => row.status === "completed" && row.completionDate);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextSevenDays = endOfDay(new Date(now.getTime() + 7 * DAY_MS));

    const filteredEmployeeRecords = employeeRecords.filter((record: any) => {
      const user = userById.get(String(record.userId));
      if (!user || TERMINATED_EMPLOYMENT_STATUSES.has(normalizedStatus(record.employmentStatus))) return false;
      if (query.departmentId && String(record.departmentId || "") !== query.departmentId) return false;
      if (query.managerId && String(record.managerUserId || "") !== query.managerId) return false;
      if (search && !`${user.fullName} ${user.email}`.toLowerCase().includes(search)) return false;
      const hireDate = asDate(record.hireDate);
      if ((from || to) && !within(hireDate, from, to)) return false;
      return true;
    });
    const probationNow = filteredEmployeeRecords.filter((record: any) => {
      const end = asDate(record.probationEndDate);
      const hire = asDate(record.hireDate);
      return Boolean(end && end >= now && (!hire || hire <= now));
    });

    const reviewByEmployee = new Map<string, any[]>();
    probationReviews.forEach((review: any) => reviewByEmployee.set(String(review.employeeUserId), [...(reviewByEmployee.get(String(review.employeeUserId)) || []), review]));
    const overdueReviewEmployees = new Set<string>();
    filteredEmployeeRecords.forEach((record: any) => {
      const reviews = reviewByEmployee.get(String(record.userId)) || [];
      const hasCompletedReview = reviews.some((review) => COMPLETED_REVIEW_STATUSES.has(normalizedStatus(review.status)));
      const hasOverdueReview = reviews.some((review) => asDate(review.periodEnd) && asDate(review.periodEnd)! < now && !COMPLETED_REVIEW_STATUSES.has(normalizedStatus(review.status)));
      const probationEndedWithoutReview = asDate(record.probationEndDate) && asDate(record.probationEndDate)! < now && !hasCompletedReview;
      if (hasOverdueReview || probationEndedWithoutReview) overdueReviewEmployees.add(String(record.userId));
    });

    const statusBreakdown = (["not_started", "in_progress", "blocked", "overdue", "completed"] as AnalyticsStatus[]).map((status) => ({
      status,
      count: filteredRows.filter((row) => row.status === status).length,
    }));

    const eventDates = dimensionRows.flatMap((row) => [row.startDate, row.completionDate]).filter(Boolean) as Date[];
    const trendFrom = from || (eventDates.length ? new Date(Math.min(...eventDates.map((date) => date.getTime()))) : new Date(now.getFullYear(), 0, 1));
    const trendTo = to || now;
    const bucketMap = new Map<string, { key: string; label: string; started: number; completed: number }>();
    for (let cursor = startOfBucket(trendFrom, interval); cursor <= trendTo; cursor = nextBucket(cursor, interval)) {
      const key = cursor.toISOString();
      bucketMap.set(key, { key, label: bucketLabel(cursor, interval), started: 0, completed: 0 });
    }
    dimensionRows.forEach((row) => {
      if (within(row.startDate, trendFrom, trendTo)) {
        const bucket = bucketMap.get(startOfBucket(row.startDate!, interval).toISOString());
        if (bucket) bucket.started += 1;
      }
      if (within(row.completionDate, trendFrom, trendTo)) {
        const bucket = bucketMap.get(startOfBucket(row.completionDate!, interval).toISOString());
        if (bucket) bucket.completed += 1;
      }
    });

    const departmentGroups = new Map<string, any[]>();
    filteredRows.forEach((row) => {
      const key = String(row.departmentId || "unassigned");
      departmentGroups.set(key, [...(departmentGroups.get(key) || []), row]);
    });
    const departmentAnalytics = Array.from(departmentGroups.entries()).map(([departmentId, rows]) => {
      const completedDurations = rows.filter((row) => row.completionDate && row.initializedAt).map((row) => daysBetween(row.initializedAt!, row.completionDate!));
      return {
        departmentId: departmentId === "unassigned" ? null : departmentId,
        department: rows[0]?.department || "Unassigned",
        activeOnboarding: rows.filter((row) => row.status !== "completed").length,
        completedThisMonth: rows.filter((row) => row.completionDate && row.completionDate >= monthStart && row.completionDate < nextMonth).length,
        overdueEmployees: rows.filter((row) => row.expectedCompletion && row.expectedCompletion < now && row.status !== "completed").length,
        averageCompletionDays: average(completedDurations),
        averageProgress: Math.round(average(rows.map((row) => row.progress))),
      };
    }).sort((a, b) => b.activeOnboarding - a.activeOnboarding || a.department.localeCompare(b.department));

    const taskTotals = combineTaskStats(...filteredRows.map((row) => row.taskStats));
    const attentionRows = filteredRows
      .filter((row) => row.issue)
      .sort((a, b) => b.daysOverdue - a.daysOverdue || (a.expectedCompletion?.getTime() || Number.MAX_SAFE_INTEGER) - (b.expectedCompletion?.getTime() || Number.MAX_SAFE_INTEGER))
      .map((row) => ({
        id: row.id,
        onboardingId: row.onboardingId,
        employee: row.employee,
        department: row.department,
        startDate: row.startDate,
        progress: row.progress,
        currentIssue: row.issue!.label,
        responsiblePerson: row.issue!.responsiblePerson,
        daysOverdue: row.daysOverdue,
      }));
    const activeTableRows = activeRows
      .sort((a, b) => (a.expectedCompletion?.getTime() || Number.MAX_SAFE_INTEGER) - (b.expectedCompletion?.getTime() || Number.MAX_SAFE_INTEGER))
      .map((row) => ({
        id: row.id,
        onboardingId: row.onboardingId,
        employee: row.employee,
        position: row.position,
        department: row.department,
        manager: row.manager,
        startDate: row.startDate,
        completedTasks: row.taskStats.completed,
        remainingTasks: Math.max(0, row.taskStats.required - row.taskStats.completed),
        progress: row.progress,
        currentStage: row.currentStage,
        expectedCompletion: row.expectedCompletion,
        status: row.status,
      }));

    return {
      generatedAt: now,
      summary: {
        activeOnboarding: activeRows.length,
        startingWithinSevenDays: activeRows.filter((row) => row.startDate && row.startDate >= startOfDay(now) && row.startDate <= nextSevenDays).length,
        completedThisMonth: completedRows.filter((row) => row.completionDate! >= monthStart && row.completionDate! < nextMonth).length,
        overdueOnboarding: activeRows.filter((row) => row.expectedCompletion && row.expectedCompletion < now).length,
        onProbation: probationNow.length,
        averageCompletionDays: average(completedRows.filter((row) => row.initializedAt).map((row) => daysBetween(row.initializedAt!, row.completionDate!))),
      },
      statusBreakdown,
      trend: { interval, rows: Array.from(bucketMap.values()) },
      attention: paginate(attentionRows, attentionPage, pageSize),
      active: paginate(activeTableRows, activePage, pageSize),
      tasks: { ...taskTotals, completionPercentage: taskTotals.required ? Math.round((taskTotals.completed / taskTotals.required) * 100) : 0 },
      departments: departmentAnalytics,
      probation: {
        currentlyOnProbation: probationNow.length,
        endingInSevenDays: probationNow.filter((record: any) => asDate(record.probationEndDate)! <= nextSevenDays).length,
        endingInThirtyDays: probationNow.filter((record: any) => asDate(record.probationEndDate)! <= endOfDay(new Date(now.getTime() + 30 * DAY_MS))).length,
        reviewsOverdue: overdueReviewEmployees.size,
      },
      filters: {
        departments: departments.map((department: any) => ({ id: department.id, name: department.name })).sort((a: any, b: any) => a.name.localeCompare(b.name)),
        managers: users
          .filter((user: any) => employeeRecords.some((record: any) => String(record.managerUserId || "") === String(user.id)) || offers.some((offer: any) => String(offer.reportingManagerId || "") === String(user.id)))
          .map((user: any) => ({ id: user.id, name: user.fullName }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name)),
        statuses: ["not_started", "in_progress", "blocked", "overdue", "completed"],
      },
    };
  }
}
