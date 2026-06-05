import { db } from "../../models";
import { DEFAULT_EMPLOYMENT_TYPE } from "../../constants/employee.constants";

export class RecruitmentService {
  async provisionForms(businessId: string) {
    const templates = [
      { key: "job_posting", title: "Job Posting Form" },
      { key: "recruitment_application", title: "Recruitment Application Form" },
      { key: "cv_screening", title: "CV Screening Form" },
      { key: "interview_feedback", title: "Job Interview Feedback Form" },
      {
        key: "hiring_decision",
        title: "Hiring Decision & Offer Approval Form",
      },
      { key: "onboarding_checklist", title: "Onboarding Checklist Form" },
      { key: "asset_provisioning", title: "Asset & Access Provisioning Form" },
      { key: "policy_acknowledgement", title: "Policy Acknowledgement Form" },
      { key: "probation_kpi", title: "Probation KPI Plan Form" },
    ];
    for (const t of templates) {
      const existing = await db.FormDefinition.findOne({
        where: { businessId, key: t.key },
      });
      if (!existing) {
        await db.FormDefinition.create({
          businessId,
          name: t.title,
          key: t.key,
          visibility: "internal",
          version: 1,
          schema: { type: "object", properties: {} },
        });
      }
    }
  }

  async publicApply(jobOpeningId: string, payload: any) {
    const job = await db.JobOpening.findByPk(jobOpeningId);
    if (!job || job.status !== "open")
      throw new Error("Job is not open or does not exist.");

    // Robust field extraction
    let {
      fullName,
      firstName,
      lastName,
      email,
      phone,
      source,
      cvFileId,
      ...extraFields
    } = payload;

    // Combine names if necessary
    if (!fullName && (firstName || lastName)) {
      fullName = [firstName, lastName].filter(Boolean).join(" ");
    }

    // Ensure we have a name
    if (!fullName) fullName = email || "Anonymous Applicant";

    // Try to find a CV/Resume if cvFileId is missing
    if (!cvFileId) {
      cvFileId =
        extraFields.resume || extraFields.cv || extraFields.resumeUrl || null;
      // If it's a UUID, we keep it, otherwise it stays in metadata as a string/link
      if (
        cvFileId &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          cvFileId,
        )
      ) {
        cvFileId = null;
      }
    }

    // Construct metadata by removing core fields to avoid duplication
    const metadata = { ...extraFields };
    if (firstName) metadata.firstName = firstName;
    if (lastName) metadata.lastName = lastName;

    return db.JobApplication.create({
      businessId: job.businessId,
      jobOpeningId: job.id,
      fullName,
      email,
      phone: phone || null,
      source: source || "portal",
      cvFileId: cvFileId || null,
      metadata: metadata || {},
    }).then(async (application: any) => {
      // Backfill the applicationId into the file asset metadata so the resume
      // is traceable from both directions (application → file, file → application)
      if (cvFileId) {
        try {
          const asset = await db.FileAsset.findByPk(cvFileId);
          if (asset) {
            await asset.update({
              metadata: { ...(asset.metadata || {}), jobApplicationId: application.id },
            });
          }
        } catch {
          // Non-critical — don't fail the application if metadata update fails
        }
      }
      return application;
    });
  }

  async advanceApplicant(id: string, businessId: string, stage: string) {
    const app = await db.JobApplication.findOne({ where: { id, businessId } });
    if (!app) throw new Error("Application not found.");
    await app.update({ stage });

    // If mapped natively directly into hired status without automated API flow trigger onboard explicitly
    if (stage === "hired") {
      const checkUser = await db.User.findOne({
        where: { email: app.email, businessId },
      });
      const targetUserId = checkUser
        ? checkUser.id
        : "fake-user-id-for-scaffold";
      // In real execution, mapping User creation occurs structurally resolving the email into a verified Auth pool before EmployeeRecord binds physically
      await db.EmployeeRecord.create({
        businessId,
        userId: targetUserId,
        employeeCode: "EMP-" + Math.floor(Math.random() * 10000),
        employmentType: DEFAULT_EMPLOYMENT_TYPE,
        hireDate: new Date(),
      });

      // Trigger base onboarding
      await db.OnboardingTask.create({
        businessId,
        employeeUserId: targetUserId,
        title: "Complete Profile Setup",
        category: "general",
      });

      const job = await db.JobOpening.findOne({
        where: { id: app.jobOpeningId, businessId },
      });
      if (job && ["open", "active", "published"].includes(job.status)) {
        const hiredCount = await db.JobApplication.count({
          where: { businessId, jobOpeningId: app.jobOpeningId, stage: "hired" },
        });
        const headcount = Number(job.headcount || 1);
        if (hiredCount >= headcount) {
          await job.update({ status: "closed" });
        }
      }
    }
    return app;
  }
}
