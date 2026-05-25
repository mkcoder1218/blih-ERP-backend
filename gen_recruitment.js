const fs = require('fs');
const path = require('path');

const root = process.cwd();
const src = path.join(root, 'src');
const modelsPath = path.join(src, 'models');
const ensureDir = (d) => fs.mkdirSync(d, { recursive: true });

// 1. JobOpening Model
fs.writeFileSync(path.join(modelsPath, 'JobOpening.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type JobOpeningModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): JobOpeningModel => {
  const JobOpening = sequelize.define("JobOpening", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    departmentId: { type: dataTypes.UUID, allowNull: true },
    positionId: { type: dataTypes.UUID, allowNull: true },
    requestedByUserId: { type: dataTypes.UUID, allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: false },
    employmentType: { type: dataTypes.STRING(50) },
    headcount: { type: dataTypes.INTEGER, defaultValue: 1 },
    salaryRange: { type: dataTypes.JSONB, defaultValue: {} },
    status: { type: dataTypes.STRING(50), defaultValue: 'draft' }, // draft, open, paused, closed
    priority: { type: dataTypes.STRING(50), defaultValue: 'medium' },
    description: { type: dataTypes.TEXT, allowNull: false },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "hr_job_openings", timestamps: true, paranoid: true }) as JobOpeningModel;

  JobOpening.associate = (models: any) => {
    models.JobOpening.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.User) models.JobOpening.belongsTo(models.User, { foreignKey: "requestedByUserId", as: "requester" });
  };
  return JobOpening;
};
`);

// 2. JobApplication Model
fs.writeFileSync(path.join(modelsPath, 'JobApplication.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type JobApplicationModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): JobApplicationModel => {
  const JobApplication = sequelize.define("JobApplication", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    jobOpeningId: { type: dataTypes.UUID, allowNull: false },
    fullName: { type: dataTypes.STRING(255), allowNull: false },
    email: { type: dataTypes.STRING(255), allowNull: false },
    phone: { type: dataTypes.STRING(50), allowNull: true },
    source: { type: dataTypes.STRING(100), defaultValue: 'careers_page' },
    stage: { type: dataTypes.STRING(50), defaultValue: 'applied' }, // applied, screened, shortlisted, interviewed, offered, hired, rejected
    score: { type: dataTypes.FLOAT, allowNull: true },
    cvFileId: { type: dataTypes.UUID, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "hr_job_applications", timestamps: true, paranoid: true }) as JobApplicationModel;

  JobApplication.associate = (models: any) => {
    models.JobApplication.belongsTo(models.Business, { foreignKey: "businessId" });
    models.JobApplication.belongsTo(models.JobOpening, { foreignKey: "jobOpeningId" });
  };
  return JobApplication;
};
`);

// 3. Interview Model
fs.writeFileSync(path.join(modelsPath, 'Interview.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type InterviewModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): InterviewModel => {
  const Interview = sequelize.define("Interview", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    jobApplicationId: { type: dataTypes.UUID, allowNull: false },
    scheduledByUserId: { type: dataTypes.UUID, allowNull: false },
    interviewerUserId: { type: dataTypes.UUID, allowNull: true },
    interviewAt: { type: dataTypes.DATE, allowNull: false },
    status: { type: dataTypes.STRING(50), defaultValue: 'scheduled' }, // scheduled, completed, cancelled, no_show
    feedback: { type: dataTypes.JSONB, defaultValue: {} },
    score: { type: dataTypes.FLOAT, allowNull: true }
  }, { tableName: "hr_interviews", timestamps: true, paranoid: true }) as InterviewModel;

  Interview.associate = (models: any) => {
    models.Interview.belongsTo(models.Business, { foreignKey: "businessId" });
    models.Interview.belongsTo(models.JobApplication, { foreignKey: "jobApplicationId" });
    if(models.User) {
        models.Interview.belongsTo(models.User, { foreignKey: "scheduledByUserId", as: "scheduler" });
        models.Interview.belongsTo(models.User, { foreignKey: "interviewerUserId", as: "interviewer" });
    }
  };
  return Interview;
};
`);

// 4. OnboardingTask Model
fs.writeFileSync(path.join(modelsPath, 'OnboardingTask.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type OnboardingTaskModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): OnboardingTaskModel => {
  const OnboardingTask = sequelize.define("OnboardingTask", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    employeeUserId: { type: dataTypes.UUID, allowNull: false },
    assignedToUserId: { type: dataTypes.UUID, allowNull: true },
    title: { type: dataTypes.STRING(255), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    category: { type: dataTypes.STRING(100), defaultValue: 'general' }, // IT, HR, Training
    dueDate: { type: dataTypes.DATE, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: 'pending' }, // pending, in_progress, completed
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "hr_onboarding_tasks", timestamps: true, paranoid: true }) as OnboardingTaskModel;

  OnboardingTask.associate = (models: any) => {
    models.OnboardingTask.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.User) {
        models.OnboardingTask.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
        models.OnboardingTask.belongsTo(models.User, { foreignKey: "assignedToUserId", as: "assignee" });
    }
  };
  return OnboardingTask;
};
`);

// Ensure HR Directory
ensureDir(path.join(src, 'modules', 'hr'));

// Create Recruitment Service
fs.writeFileSync(path.join(src, 'modules', 'hr', 'recruitment.service.ts'), `
import { db } from '../../models';

export class RecruitmentService {

  async provisionForms(businessId: string) {
     const templates = [
        { key: 'job_posting', title: 'Job Posting Form' },
        { key: 'recruitment_application', title: 'Recruitment Application Form' },
        { key: 'cv_screening', title: 'CV Screening Form' },
        { key: 'interview_feedback', title: 'Job Interview Feedback Form' },
        { key: 'hiring_decision', title: 'Hiring Decision & Offer Approval Form' },
        { key: 'onboarding_checklist', title: 'Onboarding Checklist Form' },
        { key: 'asset_provisioning', title: 'Asset & Access Provisioning Form' },
        { key: 'policy_acknowledgement', title: 'Policy Acknowledgement Form' },
        { key: 'probation_kpi', title: 'Probation KPI Plan Form' }
     ];
     for (const t of templates) {
        const existing = await db.FormDefinition.findOne({ where: { businessId, key: t.key } });
        if (!existing) {
           await db.FormDefinition.create({
              businessId,
              name: t.title,
              key: t.key,
              visibility: 'internal',
              version: 1,
              schema: { type: 'object', properties: {} }
           });
        }
     }
  }

  async publicApply(jobOpeningId: string, payload: any) {
     const job = await db.JobOpening.findByPk(jobOpeningId);
     if (!job || job.status !== 'open') throw new Error("Job is not open or does not exist.");
     
     // strict filtering to protect from payload pollution mapping arbitrary statuses or scores natively
     return db.JobApplication.create({
         businessId: job.businessId,
         jobOpeningId: job.id,
         fullName: payload.fullName,
         email: payload.email,
         phone: payload.phone,
         source: payload.source || 'portal',
         cvFileId: payload.cvFileId
     });
  }

  async advanceApplicant(id: string, businessId: string, stage: string) {
     const app = await db.JobApplication.findOne({ where: { id, businessId } });
     if(!app) throw new Error("Application not found.");
     await app.update({ stage });

     // If mapped natively directly into hired status without automated API flow trigger onboard explicitly
     if (stage === 'hired') {
        const checkUser = await db.User.findOne({ where: { email: app.email, businessId } });
        const targetUserId = checkUser ? checkUser.id : 'fake-user-id-for-scaffold'; 
        // In real execution, mapping User creation occurs structurally resolving the email into a verified Auth pool before EmployeeRecord binds physically
        await db.EmployeeRecord.create({
           businessId,
           userId: targetUserId,
           employeeCode: 'EMP-' + Math.floor(Math.random()*10000),
           employmentType: 'full_time',
           hireDate: new Date()
        });

        // Trigger base onboarding
        await db.OnboardingTask.create({
           businessId,
           employeeUserId: targetUserId,
           title: 'Complete Profile Setup',
           category: 'general'
        });
     }
     return app;
  }
}
`);

// Create Recruitment Controller
fs.writeFileSync(path.join(src, 'modules', 'hr', 'recruitment.controller.ts'), `
import type { Request, Response } from 'express';
import { RecruitmentService } from './recruitment.service';
import { errorResponse, successResponse, paginationResponse } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';
import { db } from '../../models';

export class RecruitmentController {
   private service = new RecruitmentService();

   seedForms = async (req: Request, res: Response) => {
     await this.service.provisionForms(req.user!.businessId);
     successResponse(res, null, "Recruitment templates seeded.");
   };

   // Public Apply
   publicApply = async (req: Request, res: Response) => {
     try {
       const app = await this.service.publicApply(req.params.jobOpeningId, req.body);
       // Do not bind AuditLogService mapping heavily due to absent Request User mapping structurally
       successResponse(res, { jobApplicationId: app.id }, "Application received.", 201);
     } catch (e: any) { errorResponse(res, e.message); }
   };

   listOpenings = async (req: Request, res: Response) => {
       try {
           const limit = Number(req.query.limit || 20);
           const offset = Number(req.query.offset || 0);
           const q: any = { businessId: req.user!.businessId };
           const result = await db.JobOpening.findAndCountAll({ where: q, limit, offset });
           paginationResponse(res, result.rows, result.count, offset/limit + 1, limit);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   createOpening = async (req: Request, res: Response) => {
       try {
           const opening = await db.JobOpening.create({ ...req.body, businessId: req.user!.businessId, requestedByUserId: req.user!.id });
           await AuditLogService.log('CREATED_JOB_OPENING', 'hr_job_openings', String(opening.id), null, {}, req);
           successResponse(res, opening, "Job opening defined.", 201);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   advanceApplicant = async (req: Request, res: Response) => {
       try {
           const { stage } = req.body;
           const result = await this.service.advanceApplicant(req.params.id, req.user!.businessId, stage);
           await AuditLogService.log('ADVANCED_APPLICANT', 'hr_job_applications', String(result.id), null, { stage }, req);
           successResponse(res, result);
       } catch (e: any) { errorResponse(res, e.message); }
   };
}
`);

// Route merging into hr.routes.ts
const hrRoutesPath = path.join(src, 'modules', 'hr', 'hr.routes.ts');
let hrRoutes = fs.readFileSync(hrRoutesPath, 'utf8');

if (!hrRoutes.includes('RecruitmentController')) {
   hrRoutes = hrRoutes.replace("import { HRController } from './hr.controller';", "import { HRController } from './hr.controller';\nimport { RecruitmentController } from './recruitment.controller';");
   hrRoutes = hrRoutes.replace("const controller = new HRController();", "const controller = new HRController();\nconst recruitmentController = new RecruitmentController();");
   
   hrRoutes += `

router.post('/recruitment/templates', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(recruitmentController.seedForms));
router.get('/recruitment/job-openings', authRequired, asyncHandler(recruitmentController.listOpenings));
router.post('/recruitment/job-openings', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(recruitmentController.createOpening));
router.patch('/recruitment/applications/:id/stage', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(recruitmentController.advanceApplicant));

// Public application endpoint must skip auth
export const publicRecruitmentRoutes = Router();
publicRecruitmentRoutes.post('/job-openings/:jobOpeningId/apply', asyncHandler(recruitmentController.publicApply));
`;
   fs.writeFileSync(hrRoutesPath, hrRoutes);
}

// Modify app.ts to mount publicRecruitmentRoutes
const appPath = path.join(src, 'app.ts');
let appContent = fs.readFileSync(appPath, 'utf8');
if (!appContent.includes('publicRecruitmentRoutes')) {
   appContent = appContent.replace(
      'import { hrRoutes } from "./modules/hr/hr.routes";', 
      'import { hrRoutes, publicRecruitmentRoutes } from "./modules/hr/hr.routes";'
   );
   // Inject natively BEFORE the active module wrapper enforcing token limits internally
   appContent = appContent.replace(
      'apiRouter.use("/hr", hrRoutes);', 
      'apiRouter.use("/hr/public", publicRecruitmentRoutes);\napiRouter.use("/hr", hrRoutes);'
   );
   fs.writeFileSync(appPath, appContent);
}

console.log("Recruitment Scaffolding Completed.");
