"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecruitmentService = void 0;
const models_1 = require("../../models");
class RecruitmentService {
    async provisionForms(businessId) {
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
            const existing = await models_1.db.FormDefinition.findOne({ where: { businessId, key: t.key } });
            if (!existing) {
                await models_1.db.FormDefinition.create({
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
    async publicApply(jobOpeningId, payload) {
        const job = await models_1.db.JobOpening.findByPk(jobOpeningId);
        if (!job || job.status !== 'open')
            throw new Error("Job is not open or does not exist.");
        // strict filtering to protect from payload pollution mapping arbitrary statuses or scores natively
        return models_1.db.JobApplication.create({
            businessId: job.businessId,
            jobOpeningId: job.id,
            fullName: payload.fullName,
            email: payload.email,
            phone: payload.phone,
            source: payload.source || 'portal',
            cvFileId: payload.cvFileId
        });
    }
    async advanceApplicant(id, businessId, stage) {
        const app = await models_1.db.JobApplication.findOne({ where: { id, businessId } });
        if (!app)
            throw new Error("Application not found.");
        await app.update({ stage });
        // If mapped natively directly into hired status without automated API flow trigger onboard explicitly
        if (stage === 'hired') {
            const checkUser = await models_1.db.User.findOne({ where: { email: app.email, businessId } });
            const targetUserId = checkUser ? checkUser.id : 'fake-user-id-for-scaffold';
            // In real execution, mapping User creation occurs structurally resolving the email into a verified Auth pool before EmployeeRecord binds physically
            await models_1.db.EmployeeRecord.create({
                businessId,
                userId: targetUserId,
                employeeCode: 'EMP-' + Math.floor(Math.random() * 10000),
                employmentType: 'full_time',
                hireDate: new Date()
            });
            // Trigger base onboarding
            await models_1.db.OnboardingTask.create({
                businessId,
                employeeUserId: targetUserId,
                title: 'Complete Profile Setup',
                category: 'general'
            });
        }
        return app;
    }
}
exports.RecruitmentService = RecruitmentService;
