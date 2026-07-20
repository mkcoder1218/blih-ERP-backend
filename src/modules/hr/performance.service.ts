
import { Op } from 'sequelize';
import { ACTIVE_EMPLOYMENT_STATUS, TERMINATED_EMPLOYMENT_STATUS } from '../../constants/employee.constants';
import { db } from '../../models';
import { AttendanceDailyReportService } from '../../services/attendanceDailyReport.service';
import { sendMail } from '../../services/mailer';

const COMPLETED_TASK_STATUSES = new Set(['DONE', 'COMPLETED', 'APPROVED']);
const APPROVED_TASK_STATUSES = new Set(['APPROVED']);
const BLOCKED_TASK_STATUSES = new Set(['BLOCKED']);
const EXCLUDED_BLOCKER_TYPES = new Set(['dependency', 'client', 'resource', 'management']);
const PROBATION_WEIGHT_SETTING_KEY = 'probation_assessment_weights';
const DEFAULT_PROBATION_WEIGHTS = { punctualityWeight: 30, attendanceWeight: 30, performanceWeight: 40 };
const EXIT_STATUS_TRANSITIONS: Record<string, Set<string>> = {
  pending: new Set(['in_progress', 'cancelled', 'rejected', 'interview_scheduled']),
  interview_scheduled: new Set(['interview_completed', 'in_progress', 'cancelled', 'rejected']),
  interview_completed: new Set(['in_progress', 'completed', 'cancelled', 'rejected']),
  rejected: new Set(['pending']),
  cancelled: new Set(['pending']),
  in_progress: new Set(['completed', 'cancelled', 'clearance_pending']),
  clearance_pending: new Set(['completed', 'cancelled']),
  completed: new Set(['account_disabled'])
};

export const EXIT_CLEARANCE_STEP_DEFINITIONS = [
  {
    stepKey: 'resignation_letter_signed',
    title: 'Resignation Letter Received & Signed',
    description: 'Official resignation letter submitted and acknowledged'
  },
  {
    stepKey: 'exit_interview_completed',
    title: 'Exit Interview Completed',
    description: 'Exit interview conducted and documented'
  },
  {
    stepKey: 'assets_credentials_returned',
    title: 'Assets & Credentials Returned',
    description: 'Company property, ID card, access cards, and equipment returned'
  },
  {
    stepKey: 'final_payment_settled',
    title: 'Last Payment Settled',
    description: 'Final salary, benefits, and dues cleared'
  },
  {
    stepKey: 'experience_letter_issued',
    title: 'Experience Letter Issued',
    description: 'Official experience certificates provided'
  },
  {
    stepKey: 'recommendation_letter_issued',
    title: 'Recommendation Letter (if applicable)',
    description: 'Letter of recommendation for future employment'
  }
];

export const EXIT_DOCUMENT_DEFINITIONS = [
  { documentKey: 'clearance_letter', title: 'Clearance Letter' },
  { documentKey: 'id_card', title: 'ID Card' },
  { documentKey: 'emergency_contact', title: 'Emergency Contact' },
  { documentKey: 'guarantor_info', title: 'Guarantor Info' },
  { documentKey: 'experience_letter', title: 'Experience Letter' }
];

export class HRPerformanceService {
  private dailyAttendanceReport = new AttendanceDailyReportService();

  private ymd(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private clampScore(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private normalizeReviewScore(value: any) {
    const score = Number(value ?? 0);
    if (!Number.isFinite(score) || score <= 0) return 0;
    return this.clampScore(score <= 5 ? score * 20 : score);
  }

  private async probationWeights(businessId: string) {
    const setting = await db.BusinessSetting.findOne({ where: { businessId, key: PROBATION_WEIGHT_SETTING_KEY } });
    const raw = setting?.value || {};
    const weights = {
      punctualityWeight: Number(raw.punctualityWeight ?? DEFAULT_PROBATION_WEIGHTS.punctualityWeight),
      attendanceWeight: Number(raw.attendanceWeight ?? DEFAULT_PROBATION_WEIGHTS.attendanceWeight),
      performanceWeight: Number(raw.performanceWeight ?? DEFAULT_PROBATION_WEIGHTS.performanceWeight),
    };
    const total = weights.punctualityWeight + weights.attendanceWeight + weights.performanceWeight;
    return total === 100 ? weights : DEFAULT_PROBATION_WEIGHTS;
  }

  async updateProbationWeights(businessId: string, input: any) {
    const weights = {
      punctualityWeight: Number(input?.punctualityWeight),
      attendanceWeight: Number(input?.attendanceWeight),
      performanceWeight: Number(input?.performanceWeight),
    };
    const total = weights.punctualityWeight + weights.attendanceWeight + weights.performanceWeight;
    if (!Object.values(weights).every((value) => Number.isFinite(value) && value >= 0 && value <= 100) || total !== 100) {
      throw new Error('Probation assessment weights must be valid percentages and total 100%.');
    }
    const [setting] = await db.BusinessSetting.findOrCreate({
      where: { businessId, key: PROBATION_WEIGHT_SETTING_KEY },
      defaults: { businessId, key: PROBATION_WEIGHT_SETTING_KEY, value: weights, category: 'performance', isPublic: false },
    });
    await setting.update({ value: weights, category: 'performance', isPublic: false });
    return weights;
  }

  private async probationAttendanceScores(businessId: string, employeeUserId: string, startDate: string, endDate: string) {
    const rows = await this.dailyAttendanceReport.generate(businessId, { startDate, endDate, employeeId: employeeUserId });
    const scheduledRows = rows.filter((row: any) => Number(row.ScheduledWorkingDays || 0) > 0 && Number(row.PaidDaysOff || 0) <= 0);
    const scheduledDays = scheduledRows.reduce((sum: number, row: any) => sum + Number(row.ScheduledWorkingDays || 0), 0);
    const expectedMinutes = scheduledRows.reduce((sum: number, row: any) => sum + Number(row.ExpectedMinutes || 0), 0);
    const workedMinutes = scheduledRows.reduce((sum: number, row: any) => sum + Math.round(Number(row.NetHoursWorked || 0) * 60), 0);
    const lateArrivals = scheduledRows.filter((row: any) => Number(row.MinutesLate || 0) > 0).length;
    const absences = scheduledRows.filter((row: any) => row.LatenessStatus === 'Absent').length;
    const missingCheckouts = scheduledRows.filter((row: any) => row.LatenessStatus === 'IncompletePunch').length;
    const penaltyDays = scheduledRows.filter((row: any) => row.DeductionApplied).length;
    const attendanceScore = expectedMinutes > 0 ? this.clampScore((workedMinutes / expectedMinutes) * 100) : 0;
    const punctualityPenalty = lateArrivals * 5 + absences * 12 + missingCheckouts * 8 + penaltyDays * 5;
    const punctualityScore = scheduledDays > 0 ? this.clampScore(100 - punctualityPenalty) : 0;
    return {
      punctualityScore,
      attendanceScore,
      breakdown: {
        scheduledDays,
        expectedMinutes,
        workedMinutes,
        lateArrivals,
        absences,
        missingCheckouts,
        penaltyDays,
      },
    };
  }

  private async probationReviewScore(businessId: string, employeeUserId: string, startDate: Date, endDate: Date) {
    const reviews = await db.PerformanceReview.findAll({
      where: {
        businessId,
        employeeUserId,
        periodType: { [Op.iLike]: 'probation' },
        periodEnd: { [Op.gte]: startDate, [Op.lte]: endDate },
      },
      include: [{ model: db.User, as: 'reviewer', attributes: ['id', 'fullName', 'email'] }],
      order: [['periodEnd', 'DESC']],
    });
    const scored = reviews.map((review: any) => this.normalizeReviewScore(review.score)).filter((score: number) => score > 0);
    return {
      performanceScore: scored.length ? this.clampScore(scored.reduce((sum: number, score: number) => sum + score, 0) / scored.length) : 0,
      reviews: reviews.map((review: any) => ({
        id: review.id,
        periodStart: review.periodStart,
        periodEnd: review.periodEnd,
        score: this.normalizeReviewScore(review.score),
        status: review.status,
        reviewerName: review.reviewer?.fullName || review.reviewer?.email || null,
        reviewData: review.reviewData || {},
      })),
    };
  }

  async getProbationDashboard(businessId: string, filters: any = {}) {
    const now = new Date();
    const weights = await this.probationWeights(businessId);
    const where: any = {
      businessId,
      probationEndDate: { [Op.ne]: null },
      employmentStatus: { [Op.ne]: TERMINATED_EMPLOYMENT_STATUS },
    };
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.status === 'active') where.probationEndDate = { [Op.gt]: now };
    if (filters.status === 'completed' || filters.status === 'pending_action') where.probationEndDate = { [Op.lte]: now };
    if (filters.endFrom || filters.endTo) {
      where.probationEndDate = {
        ...(filters.endFrom ? { [Op.gte]: new Date(String(filters.endFrom)) } : {}),
        ...(filters.endTo ? { [Op.lte]: new Date(String(filters.endTo)) } : {}),
      };
    }
    const records = await db.EmployeeRecord.findAll({
      where,
      include: [
        { model: db.User, as: 'user', attributes: ['id', 'fullName', 'email', 'status'], where: { status: { [Op.ne]: 'inactive' } }, required: true },
        { model: db.Department, as: 'department', attributes: ['id', 'name'] },
        { model: db.Position, as: 'position', attributes: ['id', 'title'] },
      ],
      order: [['probationEndDate', 'ASC']],
    });
    const search = String(filters.search || '').trim().toLowerCase();
    const rows: any[] = [];
    for (const record of records as any[]) {
      const employeeName = record.user?.fullName || record.user?.email || 'Employee';
      const haystack = `${employeeName} ${record.user?.email || ''} ${record.department?.name || ''} ${record.position?.title || ''}`.toLowerCase();
      if (search && !haystack.includes(search)) continue;
      const startDateObj = new Date(record.contractStartDate || record.hireDate || record.createdAt);
      const endDateObj = new Date(record.probationEndDate);
      const startDate = this.ymd(startDateObj);
      const endDate = this.ymd(endDateObj);
      const daysRemaining = Math.max(0, Math.ceil((endDateObj.getTime() - now.getTime()) / 86_400_000));
      const completed = endDateObj.getTime() <= now.getTime();
      const attendance = await this.probationAttendanceScores(businessId, record.userId, startDate, endDate);
      const review = await this.probationReviewScore(businessId, record.userId, startDateObj, endDateObj);
      const finalScore = this.clampScore(
        attendance.punctualityScore * (weights.punctualityWeight / 100) +
        attendance.attendanceScore * (weights.attendanceWeight / 100) +
        review.performanceScore * (weights.performanceWeight / 100)
      );
      const status = completed ? (record.completionEmailSentAt ? 'Completed' : 'Pending HR action') : daysRemaining <= 7 ? 'Ending soon' : 'Active';
      if (filters.status === 'pending_action' && status !== 'Pending HR action') continue;
      rows.push({
        employeeId: record.userId,
        employeeName,
        employeeEmail: record.user?.email || null,
        department: record.department ? { id: record.department.id, name: record.department.name } : null,
        position: record.position ? { id: record.position.id, title: record.position.title } : null,
        probationStartDate: startDate,
        probationEndDate: endDate,
        daysRemaining,
        countdownLabel: completed ? 'Completed' : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
        punctualityScore: attendance.punctualityScore,
        attendanceScore: attendance.attendanceScore,
        performanceScore: review.performanceScore,
        finalScore,
        status,
        probationCompletedAt: record.probationCompletedAt,
        completionEmailSentAt: record.completionEmailSentAt,
        weights,
        attendanceBreakdown: attendance.breakdown,
        reviews: review.reviews,
      });
    }
    const summary = {
      activeProbation: rows.filter((row: any) => row.status === 'Active' || row.status === 'Ending soon').length,
      endingWithin7Days: rows.filter((row: any) => row.daysRemaining > 0 && row.daysRemaining <= 7).length,
      completed: rows.filter((row: any) => row.status === 'Completed').length,
      pendingHrAction: rows.filter((row: any) => row.status === 'Pending HR action').length,
    };
    return { summary, weights, rows };
  }

  async processProbationCompletionNotifications() {
    const now = new Date();
    const records = await db.EmployeeRecord.findAll({
      where: {
        probationEndDate: { [Op.lte]: now },
        employmentStatus: { [Op.ne]: TERMINATED_EMPLOYMENT_STATUS },
        completionEmailSentAt: null,
      },
      include: [
        { model: db.User, as: 'user', attributes: ['id', 'fullName', 'email'] },
        { model: db.Business, attributes: ['id', 'name'] },
      ],
    });
    let sent = 0;
    for (const record of records as any[]) {
      const hrManagers = await db.User.findAll({
        where: { businessId: record.businessId, status: 'active' },
        include: [{ model: db.Role, where: { key: 'HR_MANAGER' }, required: true }],
      });
      if (!record.probationCompletedAt) await record.update({ probationCompletedAt: now });
      const employeeName = record.user?.fullName || record.user?.email || 'Employee';
      for (const manager of hrManagers as any[]) {
        await sendMail({
          to: manager.email,
          subject: `Probation ended: ${employeeName}`,
          text: `The probation period for ${employeeName} has ended. Please contact the employee and process contract renewal or termination.`,
          html: `<p>The probation period for <strong>${employeeName}</strong> has ended. Please contact the employee and process contract renewal or termination.</p>`,
        });
      }
      await record.update({ completionEmailSentAt: new Date() });
      sent += hrManagers.length;
    }
    return { scanned: records.length, emailsSent: sent };
  }

  async provisionForms(businessId: string) {
     const templates = [
        { key: 'performance_review', title: 'Performance Review Form' },
        { key: 'probation_evaluation', title: 'Probation Evaluation Form' },
        { key: 'training_request', title: 'Training Request Form' },
        { key: 'training_feedback', title: 'Training Feedback Form' },
        { key: 'skill_gap_assess', title: 'Skill Gap Assessment Form' },
        { key: 'disciplinary_action', title: 'Disciplinary Action / Grievance Form' },
        { key: 'incident_report', title: 'Incident Report Form' },
        { key: 'employee_resignation', title: 'Employee Resignation Form' },
        { key: 'exit_interview', title: 'Exit Interview Form' },
        { key: 'offboarding_checklist', title: 'Offboarding Checklist Form' },
        { key: 'asset_return_clearance', title: 'Asset Return & Clearance Form' },
        { key: 'experience_letter', title: 'Experience Letter & Final Pay Request Form' }
     ];
     for (const t of templates) {
        const existing = await db.FormDefinition.findOne({ where: { businessId, moduleKey: 'hr', key: t.key } });
        if (!existing) {
           await db.FormDefinition.create({
              businessId,
              moduleKey: 'hr',
              name: t.title,
              key: t.key,
              description: `${t.title} template`,
              status: 'active',
              settings: {
                 category: t.key.startsWith('exit') || ['employee_resignation', 'offboarding_checklist', 'asset_return_clearance', 'experience_letter'].includes(t.key) ? 'exit' : 'performance',
                 version: 1,
                 schema: { type: 'object', properties: {} }
              }
           });
        }
     }
  }
async processExit(
  businessId: string,
  exitId: string,
  status: string,
  options: any = {},
) {
  const exitProcess =
    await db.ExitProcess.findOne({
      where: {
        id: exitId,
        businessId,
      },
    });

  if (!exitProcess) {
    throw new Error(
      "Exit process not found.",
    );
  }

  const currentStatus = String(
    exitProcess.status || "pending",
  );

  if (
    !EXIT_STATUS_TRANSITIONS[
      currentStatus
    ]?.has(status)
  ) {
    throw new Error(
      `Invalid exit status transition from ${currentStatus} to ${status}.`,
    );
  }

  const employeeUserId =
    exitProcess.employeeUserId;

  const payload: any = {
    status,
  };

  if (
    [
      "in_progress",
      "clearance_pending",
      "completed",
      "rejected",
      "cancelled",
    ].includes(status)
  ) {
    payload.reviewedByUserId =
      options.reviewedByUserId;

    payload.reviewedAt =
      new Date();
  }

  if (
    status === "in_progress" ||
    status === "clearance_pending"
  ) {
    payload.effectiveDate =
      options.effectiveDate ||
      exitProcess.effectiveDate;

    payload.approvalNote =
      options.approvalNote ??
      exitProcess.approvalNote;

    payload.rejectionReason = null;

    /*
     * Approval starts the notice or clearance
     * process. It must not put the employee
     * on leave or deactivate the account.
     */
    const employeeRecord =
      await db.EmployeeRecord.findOne({
        where: {
          businessId,
          userId: employeeUserId,
        },
      });

    if (
      employeeRecord &&
      employeeRecord.employmentStatus !==
        ACTIVE_EMPLOYMENT_STATUS
    ) {
      await employeeRecord.update({
        employmentStatus:
          ACTIVE_EMPLOYMENT_STATUS,
      });
    }
  }

  if (
    status === "rejected" ||
    status === "cancelled"
  ) {
    payload.rejectionReason =
      options.rejectionReason ??
      exitProcess.rejectionReason;

    const employeeRecord =
      await db.EmployeeRecord.findOne({
        where: {
          businessId,
          userId: employeeUserId,
        },
      });

    if (
      employeeRecord &&
      employeeRecord.employmentStatus !==
        ACTIVE_EMPLOYMENT_STATUS
    ) {
      await employeeRecord.update({
        employmentStatus:
          ACTIVE_EMPLOYMENT_STATUS,
      });
    }
  }

  if (status === "completed") {
    /*
     * Do not use the old leave-window rule.
     * Exit notice is controlled by effectiveDate
     * and noticePeriodDays.
     */
    const effectiveDate =
      exitProcess.effectiveDate
        ? new Date(
            exitProcess.effectiveDate,
          )
        : null;

    if (!effectiveDate) {
      throw new Error(
        "A final working date is required before completing the exit.",
      );
    }

    effectiveDate.setHours(
      23,
      59,
      59,
      999,
    );

    if (
      effectiveDate.getTime() >
      Date.now()
    ) {
      const daysRemaining =
        Math.ceil(
          (
            effectiveDate.getTime() -
            Date.now()
          ) /
            86_400_000,
        );

      throw new Error(
        `The exit cannot be completed before the final working date (${daysRemaining} day(s) remaining).`,
      );
    }

    await this.assertOffboardingCanComplete(
      businessId,
      exitProcess,
    );

    const employeeRecord =
      await db.EmployeeRecord.findOne({
        where: {
          businessId,
          userId: employeeUserId,
        },
      });

    if (employeeRecord) {
      await employeeRecord.update({
        employmentStatus:
          TERMINATED_EMPLOYMENT_STATUS,
      });
    }

    /*
     * Keep actual user deactivation in
     * disableOffboardingAccount().
     *
     * Completion means employment ended,
     * while account deactivation remains
     * an explicit final action.
     */
  }

  return exitProcess.update(
    payload,
  );
}
  assertLeaveWindowComplete(exitProcess: any) {
     const leaveEndsAt = exitProcess.leaveEndsAt ? new Date(exitProcess.leaveEndsAt) : null;
     if (!leaveEndsAt) throw new Error('Employee must be approved to on-leave status before final offboarding approval.');
     if (leaveEndsAt.getTime() > Date.now()) {
        const days = Math.ceil((leaveEndsAt.getTime() - Date.now()) / 86400000);
        throw new Error(`Final offboarding approval is available after the 30-day leave window ends (${days} day(s) remaining).`);
     }
  }

  async getAcceptedDevicesSnapshot(businessId: string, employeeUserId: string) {
     const devices = await db.InventoryItem.findAll({
       where: { businessId, assignedToUserId: employeeUserId },
       order: [['updatedAt', 'DESC']]
     });
     return devices.map((item: any) => ({
       id: item.id,
       name: item.name,
       category: item.category,
       assetTag: item.assetTag,
       serialNumber: item.serialNumber,
       condition: item.condition,
       status: item.status,
       acceptedAt: item.metadata?.acceptedAt || item.metadata?.employeeAcceptedAt || null,
       acceptanceStatus: item.metadata?.acceptanceStatus || item.metadata?.employeeAcceptanceStatus || 'assigned'
     }));
  }

  async sendOffboardingForm(businessId: string, exitId: string, actingUserId: string) {
     const exitProcess = await db.ExitProcess.findOne({ where: { id: exitId, businessId } });
     if (!exitProcess) throw new Error('Exit process not found.');
     if (!['in_progress', 'interview_completed', 'clearance_pending'].includes(exitProcess.status)) throw new Error('Offboarding form can only be sent after the leave request is approved.');
     const acceptedDevices = await this.getAcceptedDevicesSnapshot(businessId, exitProcess.employeeUserId);
     return exitProcess.update({
       offboardingFormSentAt: new Date(),
       offboardingFormSentByUserId: actingUserId,
       offboardingFormData: {
         ...(exitProcess.offboardingFormData || {}),
         acceptedDevices,
         sentAt: new Date().toISOString()
       }
     });
  }

  async submitOffboardingForm(businessId: string, exitId: string, employeeUserId: string, data: any) {
     const exitProcess = await db.ExitProcess.findOne({ where: { id: exitId, businessId, employeeUserId } });
     if (!exitProcess) throw new Error('Exit process not found.');
     if (!exitProcess.offboardingFormSentAt) throw new Error('HR must send the offboarding form before it can be submitted.');
     const acceptedDevices = await this.getAcceptedDevicesSnapshot(businessId, employeeUserId);
     return exitProcess.update({
       offboardingFormSubmittedAt: new Date(),
       offboardingFormData: {
         ...(exitProcess.offboardingFormData || {}),
         ...(data || {}),
         acceptedDevices,
         submittedAt: new Date().toISOString()
       }
     });
  }

  async assertOffboardingCanComplete(businessId: string, exitProcess: any) {
     const interviews = await db.ExitInterview.findAll({ where: { businessId, exitProcessId: exitProcess.id } });
     const hasOpenInterview = interviews.some((item: any) => item.status === 'scheduled');
     if (hasOpenInterview) throw new Error('Exit interview must be completed, cancelled, or waived before completion.');

     const mandatorySteps = await db.ExitClearanceStep.findAll({ where: { businessId, exitProcessId: exitProcess.id, required: true } });
     const incompleteSteps = mandatorySteps.filter((step: any) => !['completed', 'waived'].includes(step.status));
     if (incompleteSteps.length) throw new Error('All mandatory clearance and checklist items must be completed before completion.');

     const mandatoryDocs = await db.ExitDocument.findAll({ where: { businessId, exitProcessId: exitProcess.id, required: true } });
     const incompleteDocs = mandatoryDocs.filter((doc: any) => !['uploaded', 'verified', 'waived'].includes(doc.status));
     if (incompleteDocs.length) throw new Error('All required documents must be generated, uploaded, verified, or waived before completion.');
  }

  async disableOffboardingAccount(businessId: string, exitId: string, actingUserId: string) {
     const exitProcess = await db.ExitProcess.findOne({ where: { id: exitId, businessId } });
     if (!exitProcess) throw new Error('Exit process not found.');
     if (exitProcess.status !== 'completed') throw new Error('Offboarding must be completed before account deactivation.');
     if (exitProcess.accountDisabledAt) return exitProcess;

     await db.User.update({ status: 'inactive' }, { where: { id: exitProcess.employeeUserId, businessId } });
     return exitProcess.update({
       status: 'account_disabled',
       accountDisabledAt: new Date(),
       accountDisabledByUserId: actingUserId
     });
  }

  async seedExitClearanceSteps(businessId: string, exitProcessId: string, transaction?: any) {
     const existing = await db.ExitClearanceStep.count({ where: { businessId, exitProcessId }, transaction });
     if (existing > 0) return;

     await db.ExitClearanceStep.bulkCreate(
       EXIT_CLEARANCE_STEP_DEFINITIONS.map((step, index) => ({
         businessId,
         exitProcessId,
         ...step,
         sortOrder: index + 1,
         required: true,
         status: 'pending'
       })),
       { transaction }
     );
  }

  async seedExitDocuments(businessId: string, exitProcessId: string, transaction?: any) {
     const existing = await db.ExitDocument.count({ where: { businessId, exitProcessId }, transaction });
     if (existing > 0) return;

     await db.ExitDocument.bulkCreate(
       EXIT_DOCUMENT_DEFINITIONS.map((doc) => ({
         businessId,
         exitProcessId,
         ...doc,
         required: true,
         status: 'missing'
       })),
       { transaction }
     );
  }

  async getExitWithClearance(businessId: string, exitId: string) {
     return db.ExitProcess.findOne({
       where: { id: exitId, businessId },
       include: [
         {
           model: db.User,
           as: 'employee',
           attributes: ['id', 'fullName', 'email'],
           include: [{
             model: db.BusinessUserProfile,
             required: false,
             include: [
               { model: db.Department, as: 'department', attributes: ['id', 'name'] },
               { model: db.Position, as: 'position', attributes: ['id', 'title'] }
             ]
           }]
         },
         {
           model: db.ExitClearanceStep,
           as: 'clearanceSteps',
           required: false,
           include: [{ model: db.User, as: 'completedBy', attributes: ['id', 'fullName', 'email'] }]
         }
       ],
       order: [[{ model: db.ExitClearanceStep, as: 'clearanceSteps' }, 'sortOrder', 'ASC']]
     });
  }

  async updateClearanceStep(businessId: string, exitId: string, stepId: string, updates: any, actingUserId: string) {
     const exitProcess = await db.ExitProcess.findOne({ where: { id: exitId, businessId } });
     if (!exitProcess) throw new Error('Exit process not found.');

     const step = await db.ExitClearanceStep.findOne({ where: { id: stepId, exitProcessId: exitId, businessId } });
     if (!step) throw new Error('Clearance step not found.');

     const payload: any = {};
     if (updates.title !== undefined) payload.title = updates.title;
     if (updates.description !== undefined) payload.description = updates.description;
     if (updates.sortOrder !== undefined) payload.sortOrder = Number(updates.sortOrder);
     if (updates.required !== undefined) payload.required = Boolean(updates.required);
     if (updates.notes !== undefined) payload.notes = updates.notes;
     if (updates.status !== undefined) {
       if (!['pending', 'completed', 'waived', 'blocked'].includes(updates.status)) throw new Error('Invalid clearance step status.');
       payload.status = updates.status;
       payload.completedAt = ['pending', 'blocked'].includes(updates.status) ? null : new Date();
       payload.completedByUserId = ['pending', 'blocked'].includes(updates.status) ? null : actingUserId;
       payload.blockedReason = updates.status === 'blocked' ? (updates.blockedReason || updates.notes || 'Blocked') : null;
     }
     if (updates.blockedReason !== undefined) payload.blockedReason = updates.blockedReason;
     if (updates.attachments !== undefined) payload.attachments = Array.isArray(updates.attachments) ? updates.attachments : [];

     return step.update(payload);
  }

  async completeClearanceStepByKey(businessId: string, exitProcessId: string, stepKey: string, actingUserId: string, transaction?: any) {
     const step = await db.ExitClearanceStep.findOne({ where: { businessId, exitProcessId, stepKey }, transaction });
     if (!step || step.status === 'completed') return step;
     return step.update({
       status: 'completed',
       completedAt: new Date(),
       completedByUserId: actingUserId
     }, { transaction });
  }

  async updateFinalPay(businessId: string, exitId: string, actingUserId: string, data: any) {
     return db.sequelize.transaction(async (transaction: any) => {
       const exitProcess = await db.ExitProcess.findOne({ where: { id: exitId, businessId }, transaction, lock: true });
       if (!exitProcess) throw new Error('Exit process not found.');

       const nextStatus = data.status || exitProcess.finalPayData?.status || 'pending';
       if (!['pending', 'processing', 'settled'].includes(nextStatus)) throw new Error('Invalid final pay status.');

       const finalPayData = {
         ...(exitProcess.finalPayData || {}),
         status: nextStatus,
         grossAmount: data.grossAmount !== undefined ? Number(data.grossAmount) : exitProcess.finalPayData?.grossAmount,
         deductions: data.deductions !== undefined ? Number(data.deductions) : exitProcess.finalPayData?.deductions,
         netAmount: data.netAmount !== undefined ? Number(data.netAmount) : exitProcess.finalPayData?.netAmount,
         notes: data.notes !== undefined ? data.notes : exitProcess.finalPayData?.notes,
         ...(nextStatus === 'settled' ? { settledAt: new Date().toISOString(), settledByUserId: actingUserId } : {})
       };

       const updated = await exitProcess.update({ finalPayData }, { transaction });
       if (nextStatus === 'settled') {
         await this.completeClearanceStepByKey(businessId, exitId, 'final_payment_settled', actingUserId, transaction);
       }
       return updated;
     });
  }

  async getExitAnalytics(businessId: string, filters: any = {}) {
     const now = new Date();
     const from = filters.from ? new Date(filters.from) : new Date(now.getFullYear(), now.getMonth() - 11, 1);
     const to = filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : now;
     const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

     const exits = await db.ExitProcess.findAll({
       where: { businessId },
       include: [{
         model: db.User,
         as: 'employee',
         attributes: ['id', 'fullName', 'email'],
         include: [{
           model: db.BusinessUserProfile,
           required: false,
           include: [
             { model: db.Department, as: 'department', attributes: ['id', 'name'] },
             { model: db.Position, as: 'position', attributes: ['id', 'title'] }
           ]
         }]
       }],
       order: [['createdAt', 'DESC']]
     });

     const interviews = await db.ExitInterview.findAll({ where: { businessId } });
     const clearanceSteps = await db.ExitClearanceStep.findAll({ where: { businessId } });
     const employees = await db.EmployeeRecord.findAll({
       where: { businessId },
       include: [{ model: db.Department, as: 'department', attributes: ['id', 'name'] }]
     });

     const activeExits = exits.filter((item: any) => ['pending', 'in_progress'].includes(item.status));
     const recentExits = exits.filter((item: any) => new Date(item.createdAt) >= from && new Date(item.createdAt) <= to);
     const reasonCounts = new Map<string, number>();
     for (const item of recentExits as any[]) {
       const reason = item.reason || 'Unspecified';
       reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
     }

     const months = Array.from({ length: 12 }, (_, i) => {
       const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
       const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
       return { key, month: d.toLocaleString('en-US', { month: 'short' }), exits: 0, hires: 0 };
     });
     const monthByKey = new Map(months.map((m) => [m.key, m]));
     for (const item of exits as any[]) {
       const d = new Date(item.createdAt);
       const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
       const row = monthByKey.get(key);
       if (row) row.exits += 1;
     }
     for (const employee of employees as any[]) {
       const d = new Date(employee.createdAt);
       const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
       const row = monthByKey.get(key);
       if (row) row.hires += 1;
     }

     const deptMap = new Map<string, any>();
     for (const employee of employees as any[]) {
       const departmentId = employee.department?.id || 'unassigned';
       const row = deptMap.get(departmentId) || {
         departmentId: employee.department?.id || null,
         departmentName: employee.department?.name || 'Unassigned',
         employeeCount: 0,
         exits: 0,
         remaining: 0,
         attritionRate: 0
       };
       row.employeeCount += 1;
       deptMap.set(departmentId, row);
     }
     for (const item of exits as any[]) {
       const profile = item.employee?.BusinessUserProfile;
       const departmentId = profile?.department?.id || 'unassigned';
       const row = deptMap.get(departmentId) || {
         departmentId: profile?.department?.id || null,
         departmentName: profile?.department?.name || 'Unassigned',
         employeeCount: 0,
         exits: 0,
         remaining: 0,
         attritionRate: 0
       };
       row.exits += 1;
       deptMap.set(departmentId, row);
     }
     for (const row of deptMap.values()) {
       row.remaining = Math.max(row.employeeCount - row.exits, 0);
       row.attritionRate = row.employeeCount ? Number(((row.exits / row.employeeCount) * 100).toFixed(1)) : 0;
     }

     const activeNotifications = activeExits.slice(0, 6).map((item: any) => {
       const employee = item.employee;
       const name = employee?.fullName || employee?.email || 'Employee';
       const effectiveDate = item.effectiveDate ? new Date(item.effectiveDate) : null;
       const daysRemaining = effectiveDate ? Math.ceil((effectiveDate.getTime() - now.getTime()) / 86400000) : null;
       return {
         id: item.id,
         name,
         dept: employee?.BusinessUserProfile?.department?.name || 'Unassigned',
         initials: name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
         priority: daysRemaining !== null && daysRemaining <= 7 ? 'urgent' : daysRemaining !== null && daysRemaining <= 14 ? 'high' : 'low',
         text: `${item.reason || 'Resignation'} - notice period active.`,
         date: item.createdAt,
         remaining: daysRemaining === null ? 'No date set' : `${Math.max(daysRemaining, 0)} days remaining`
       };
     });

     return {
       activeResignations: activeExits.length,
       pendingInterviews: interviews.filter((item: any) => item.status === 'scheduled').length,
       clearancePending: clearanceSteps.filter((step: any) => step.status === 'pending').length,
       completedThisMonth: exits.filter((item: any) => item.status === 'completed' && new Date(item.updatedAt) >= monthStart).length,
       activeNotifications,
       topExitReasonsLast12Months: Array.from(reasonCounts.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
       monthlyTurnoverTrend: months.map(({ month, exits, hires }) => ({ month, exits, hires })),
       departmentAttritionAnalysis: Array.from(deptMap.values())
     };
  }

  exitProcessInclude() {
     return [{
       model: db.ExitProcess,
       as: 'exitProcess',
       include: [{
         model: db.User,
         as: 'employee',
         attributes: ['id', 'fullName', 'email'],
         include: [{
           model: db.BusinessUserProfile,
           required: false,
           include: [
             { model: db.Department, as: 'department', attributes: ['id', 'name'] },
             { model: db.Position, as: 'position', attributes: ['id', 'title'] }
           ]
         }]
       }]
     }];
  }

  async restrictDisciplinaryAccess(businessId: string, requestingUser: any) {
     // A generic bounding utility structurally resolving HR mapping roles
     const isHRAdmin = requestingUser.roles.some((role: string) => ['SUPER_ADMIN', 'BUSINESS_ADMIN', 'HR_MANAGER'].includes(role));
     if (!isHRAdmin) {
        throw new Error("Strict structural isolation prevents non-HR operators resolving sensitive disciplinary cases.");
     }
  }

  async getProjectPerformanceDashboard(businessId: string, filters: any = {}) {
    const employeeWhere: any = { businessId };
    if (filters.employeeUserId) employeeWhere.userId = filters.employeeUserId;
    if (filters.employeeId) employeeWhere.id = filters.employeeId;
    if (filters.departmentId) employeeWhere.departmentId = filters.departmentId;
    if (filters.team) employeeWhere[Op.or] = [
      { '$department.name$': { [Op.iLike]: `%${filters.team}%` } },
      { employeeCode: { [Op.iLike]: `%${filters.team}%` } }
    ];

    const employees = await db.EmployeeRecord.findAll({
      where: employeeWhere,
      include: [
        { model: db.User, as: 'user', attributes: ['id', 'fullName', 'email'] },
        { model: db.Department, as: 'department', attributes: ['id', 'name'] }
      ]
    });
    const rows = await Promise.all(employees.map((employee: any) => this.getEmployeeProjectMetrics(businessId, employee.userId, filters)));
    return { filters: this.normalizePeriodFilters(filters), rows };
  }

  async getEmployeeEvaluationEvidence(businessId: string, employeeUserId: string, filters: any = {}) {
    const metrics = await this.getEmployeeProjectMetrics(businessId, employeeUserId, filters);
    return { projectMetrics: metrics, scoringNote: 'Project metrics are supporting evidence only; managers retain final KPI, OKR, and overall scores.' };
  }

  async getPerformanceOverview(businessId: string, filters: any = {}) {
    const reviews = await db.PerformanceReview.findAll({
      where: { businessId },
      include: [
        { model: db.User, as: 'employee', attributes: ['id', 'fullName', 'email'] },
        { model: db.User, as: 'reviewer', attributes: ['id', 'fullName', 'email'] }
      ],
      order: [['periodEnd', 'DESC']]
    });
    const employeeRecords = await db.EmployeeRecord.findAll({
      where: { businessId },
      include: [{ model: db.Department, as: 'department', attributes: ['id', 'name'] }]
    });
    const employeeByUserId = new Map(employeeRecords.map((employee: any) => [employee.userId, employee]));
    const activeOkrs = await db.Objective.count({ where: { businessId, status: 'active' } });
    const keyResults = await db.KeyResult.findAll({ where: { businessId } });
    const onTrackOkrs = keyResults.length
      ? Math.round((keyResults.filter((kr: any) => ['on_track', 'achieved'].includes(String(kr.status).toLowerCase())).length / keyResults.length) * 100)
      : 0;

    const scoredReviews = reviews.filter((review: any) => Number.isFinite(Number(review.score)));
    const topEmployees = scoredReviews
      .slice()
      .sort((a: any, b: any) => Number(b.score) - Number(a.score))
      .slice(0, 9)
      .map((review: any) => {
        const employeeRecord: any = employeeByUserId.get(review.employeeUserId);
        return {
          reviewId: review.id,
          employeeUserId: review.employeeUserId,
          name: review.employee?.fullName || review.employee?.email || 'Employee',
          department: employeeRecord?.department?.name || 'Unassigned',
          score: Number(review.score),
          okrScore: Number(review.reviewData?.okrScore ?? review.reviewData?.okr?.score ?? 0)
        };
      });

    const departmentGroups = new Map<string, { id: string | null; name: string; count: number; totalScore: number; scoredCount: number }>();
    for (const employee of employeeRecords as any[]) {
      const departmentId = employee.department?.id || 'unassigned';
      const existing = departmentGroups.get(departmentId) || {
        id: employee.department?.id || null,
        name: employee.department?.name || 'Unassigned',
        count: 0,
        totalScore: 0,
        scoredCount: 0
      };
      existing.count += 1;
      departmentGroups.set(departmentId, existing);
    }
    for (const review of scoredReviews as any[]) {
      const employeeRecord: any = employeeByUserId.get(review.employeeUserId);
      const departmentId = employeeRecord?.department?.id || 'unassigned';
      const existing = departmentGroups.get(departmentId) || {
        id: employeeRecord?.department?.id || null,
        name: employeeRecord?.department?.name || 'Unassigned',
        count: 0,
        totalScore: 0,
        scoredCount: 0
      };
      existing.totalScore += Number(review.score);
      existing.scoredCount += 1;
      departmentGroups.set(departmentId, existing);
    }

    const trendMap = new Map<string, { total: number; count: number }>();
    for (const review of scoredReviews as any[]) {
      const monthKey = this.monthLabel(review.periodEnd || review.updatedAt || review.createdAt);
      const existing = trendMap.get(monthKey) || { total: 0, count: 0 };
      existing.total += Number(review.score);
      existing.count += 1;
      trendMap.set(monthKey, existing);
    }

    const distribution = { exceeds: 0, meets: 0, below: 0, needsImprovement: 0 };
    for (const review of scoredReviews as any[]) {
      const score = Number(review.score);
      if (score >= 4.5) distribution.exceeds += 1;
      else if (score >= 3.5) distribution.meets += 1;
      else if (score >= 2.5) distribution.below += 1;
      else distribution.needsImprovement += 1;
    }

    const projectDashboard = await this.getProjectPerformanceDashboard(businessId, filters);

    return {
      summary: {
        mostImprovedDepartment: this.mostImprovedDepartment(Array.from(departmentGroups.values())),
        reviewsDue: reviews.filter((review: any) => !['completed', 'finalized', 'acknowledged'].includes(String(review.status).toLowerCase())).length,
        activeOkrs,
        onTrackOkrs
      },
      topEmployees,
      trend: Array.from(trendMap.entries()).map(([month, value]) => ({ month, score: value.count ? Number((value.total / value.count).toFixed(1)) : 0 })),
      distribution,
      departments: Array.from(departmentGroups.values()).map((department) => ({
        id: department.id,
        name: department.name,
        employeeCount: department.count,
        averageScore: department.scoredCount ? Number((department.totalScore / department.scoredCount).toFixed(1)) : null
      })),
      projectDashboard
    };
  }

  async listPerformanceReviews(businessId: string, filters: any = {}) {
    const where: any = { businessId };
    if (filters.status) where.status = filters.status;
    if (filters.periodStart || filters.periodEnd) {
      where.periodEnd = this.dateRange(filters.periodStart, filters.periodEnd);
    }
    const reviews = await db.PerformanceReview.findAll({
      where,
      include: [
        { model: db.User, as: 'employee', attributes: ['id', 'fullName', 'email'] },
        { model: db.User, as: 'reviewer', attributes: ['id', 'fullName', 'email'] }
      ],
      order: [['updatedAt', 'DESC']]
    });
    const employeeRecords = await db.EmployeeRecord.findAll({
      where: { businessId, userId: { [Op.in]: reviews.map((review: any) => review.employeeUserId) } },
      include: [{ model: db.Department, as: 'department', attributes: ['id', 'name'] }]
    });
    const employeeByUserId = new Map(employeeRecords.map((employee: any) => [employee.userId, employee]));
    return Promise.all(reviews.map(async (review: any) => {
      const employeeRecord: any = employeeByUserId.get(review.employeeUserId);
      const evidence = await this.getEmployeeProjectMetrics(businessId, review.employeeUserId, {
        periodStart: review.periodStart,
        periodEnd: review.periodEnd
      });
      return {
        id: review.id,
        employeeUserId: review.employeeUserId,
        employeeName: review.employee?.fullName || review.employee?.email || 'Employee',
        employeeEmail: review.employee?.email,
        department: employeeRecord?.department ? { id: employeeRecord.department.id, name: employeeRecord.department.name } : null,
        reviewerName: review.reviewer?.fullName || review.reviewer?.email || null,
        periodType: review.periodType,
        periodStart: review.periodStart,
        periodEnd: review.periodEnd,
        score: review.score,
        status: review.status,
        reviewData: review.reviewData || {},
        projectEvidence: evidence
      };
    }));
  }

  async attachProjectEvidenceToReview(businessId: string, reviewId: string) {
    const review = await db.PerformanceReview.findOne({ where: { id: reviewId, businessId } });
    if (!review) throw new Error('Performance review not found');
    const evidence = await this.getEmployeeEvaluationEvidence(businessId, review.employeeUserId, {
      periodStart: review.periodStart,
      periodEnd: review.periodEnd
    });
    const reviewData = { ...(review.reviewData || {}), evidence: { ...(review.reviewData?.evidence || {}), projectMetrics: evidence.projectMetrics } };
    await review.update({ reviewData });
    return review;
  }

  private async getEmployeeProjectMetrics(businessId: string, employeeUserId: string, filters: any = {}) {
    const employee = await db.EmployeeRecord.findOne({
      where: { businessId, userId: employeeUserId },
      include: [
        { model: db.User, as: 'user', attributes: ['id', 'fullName', 'email'] },
        { model: db.Department, as: 'department', attributes: ['id', 'name'] }
      ]
    });
    if (!employee) throw new Error('Employee not found');

    const period = this.normalizePeriodFilters(filters);
    const where: any = { businessId, assigneeEmployeeId: employee.id };
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.status) where.status = String(filters.status).toUpperCase();
    if (period.periodStart || period.periodEnd) {
      where[Op.or] = [
        { createdAt: this.dateRange(period.periodStart, period.periodEnd) },
        { dueDate: this.dateOnlyRange(period.periodStart, period.periodEnd) }
      ];
    }

    const tasks = await db.ProjectTask.findAll({
      where,
      include: [{ model: db.Project, attributes: ['id', 'title', 'code', 'status'] }],
      order: [['dueDate', 'ASC']]
    });
    const taskIds = tasks.map((task: any) => task.id);
    const reopenedLogs = taskIds.length ? await db.ProjectActivityLog.findAll({
      where: {
        businessId,
        taskId: { [Op.in]: taskIds },
        action: 'PROJECT_TASK_STATUS_CHANGED'
      }
    }) : [];
    const reopenedTaskIds = new Set(reopenedLogs
      .filter((log: any) => COMPLETED_TASK_STATUSES.has(this.statusOf(log.before)) && !COMPLETED_TASK_STATUSES.has(this.statusOf(log.after)))
      .map((log: any) => log.taskId));

    const today = new Date().toISOString().slice(0, 10);
    const summary = {
      assignedTasks: tasks.length,
      assignedWeight: 0,
      completedTasks: 0,
      completedWeight: 0,
      overdueTasks: 0,
      overdueWeight: 0,
      onTimeTasks: 0,
      onTimeWeight: 0,
      blockedTasks: 0,
      blockedWeight: 0,
      reopenedTasks: reopenedTaskIds.size,
      reopenedWeight: 0,
      approvedTasks: 0,
      approvedWeight: 0,
      latePenaltyExcludedTasks: 0,
      weightedCompletionRate: 0,
      onTimeCompletionRate: 0
    };

    const evidenceTasks = tasks.map((task: any) => {
      const status = this.statusOf(task);
      const weight = this.taskWeight(task);
      const completed = COMPLETED_TASK_STATUSES.has(status);
      const approved = APPROVED_TASK_STATUSES.has(status) || task.metadata?.approved === true || task.metadata?.approvalStatus === 'approved';
      const blocked = BLOCKED_TASK_STATUSES.has(status);
      const excludedLatePenalty = this.hasApprovedExcludedBlocker(task);
      const overdue = Boolean(task.dueDate && task.dueDate < today && !completed && !excludedLatePenalty);
      const onTime = Boolean(completed && task.dueDate && task.updatedAt && this.dateOnly(task.updatedAt) <= task.dueDate);
      summary.assignedWeight += weight;
      if (completed) { summary.completedTasks += 1; summary.completedWeight += weight; }
      if (approved) { summary.approvedTasks += 1; summary.approvedWeight += weight; }
      if (blocked) { summary.blockedTasks += 1; summary.blockedWeight += weight; }
      if (overdue) { summary.overdueTasks += 1; summary.overdueWeight += weight; }
      if (onTime) { summary.onTimeTasks += 1; summary.onTimeWeight += weight; }
      if (reopenedTaskIds.has(task.id)) summary.reopenedWeight += weight;
      if (excludedLatePenalty) summary.latePenaltyExcludedTasks += 1;
      return {
        id: task.id, code: task.code, title: task.title, status, dueDate: task.dueDate,
        weight, project: task.Project ? { id: task.Project.id, code: task.Project.code, title: task.Project.title } : null,
        overdue, onTime, blocked, reopened: reopenedTaskIds.has(task.id), approved, excludedLatePenalty
      };
    });

    summary.weightedCompletionRate = summary.assignedWeight ? Math.round((summary.completedWeight / summary.assignedWeight) * 100) : 0;
    summary.onTimeCompletionRate = summary.completedWeight ? Math.round((summary.onTimeWeight / summary.completedWeight) * 100) : 0;

    return {
      employee: {
        id: employee.id,
        userId: employee.userId,
        name: employee.user?.fullName,
        email: employee.user?.email,
        department: employee.department ? { id: employee.department.id, name: employee.department.name } : null
      },
      period,
      summary,
      tasks: evidenceTasks
    };
  }

  private normalizePeriodFilters(filters: any) {
    return {
      periodStart: filters.periodStart ? this.dateOnly(filters.periodStart) : undefined,
      periodEnd: filters.periodEnd ? this.dateOnly(filters.periodEnd) : undefined
    };
  }

  private dateRange(periodStart?: string, periodEnd?: string) {
    const range: any = {};
    if (periodStart) range[Op.gte] = new Date(periodStart);
    if (periodEnd) range[Op.lte] = new Date(`${periodEnd}T23:59:59.999Z`);
    return range;
  }

  private dateOnlyRange(periodStart?: string, periodEnd?: string) {
    const range: any = {};
    if (periodStart) range[Op.gte] = periodStart;
    if (periodEnd) range[Op.lte] = periodEnd;
    return range;
  }

  private statusOf(value: any) {
    return String(value?.status || '').toUpperCase();
  }

  private dateOnly(value: any) {
    return new Date(value).toISOString().slice(0, 10);
  }

  private taskWeight(task: any) {
    const parsed = Number(task.weight ?? task.metadata?.weight ?? 1);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private hasApprovedExcludedBlocker(task: any) {
    const blocker = task.metadata?.blocker || task.metadata?.lateBlocker || {};
    const type = String(blocker.type || task.metadata?.blockerType || '').toLowerCase();
    const approved = blocker.approved === true || task.metadata?.blockerApproved === true || task.metadata?.approvalStatus === 'approved';
    return approved && EXCLUDED_BLOCKER_TYPES.has(type);
  }

  private monthLabel(value: any) {
    return new Date(value).toLocaleString('en-US', { month: 'short' });
  }

  private mostImprovedDepartment(departments: Array<{ name: string; scoredCount: number; totalScore: number }>) {
    const scored = departments
      .filter((department) => department.scoredCount > 0)
      .sort((a, b) => (b.totalScore / b.scoredCount) - (a.totalScore / a.scoredCount));
    return scored[0]?.name || null;
  }
}
