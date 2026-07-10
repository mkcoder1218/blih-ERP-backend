import type { Request, Response } from 'express';
import { HRService } from './hr.service';
import { errorResponse, successResponse, paginationResponse } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';
import { db } from '../../models';
import { renderOfferLetter } from '../../utils/offerLetterRenderer';
import { generateOfferLetterPdf } from '../../utils/offerLetterPdfGenerator';
import { sendOfferLetterEmail } from '../../utils/offerLetterMailer';
import { Op } from 'sequelize';
import { PayrollTemplateService } from '../finance/payrollTemplate.service';
import {
  DEFAULT_EMPLOYMENT_STATUS,
  DEFAULT_EMPLOYMENT_TYPE,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  type EmploymentStatus,
  type EmploymentType,
} from '../../constants/employee.constants';
import { BulkEmployeeValidationService } from './bulkEmployeeValidation.service';

export class HRController {
   private service = new HRService();
   private bulkValidationService = new BulkEmployeeValidationService();
   private payrollTemplateService = new PayrollTemplateService();

   private normalizeSystemRoleKey(input: unknown): string {
     const raw = (input ?? "EMPLOYEE").toString().trim().toUpperCase();
     const underscored = raw.replace(/[\s-]+/g, "_");
     if (underscored === "MANAGER") return "DEPARTMENT_HEAD";
     if (underscored === "HR_MANAGER" || underscored === "HRMANAGER") return "HR_MANAGER";
     return underscored || "EMPLOYEE";
   }

   private normalizeEmploymentStatus(input: unknown, fallback: EmploymentStatus = DEFAULT_EMPLOYMENT_STATUS): EmploymentStatus {
     const value = (input ?? "").toString().trim();
     return EMPLOYMENT_STATUSES.includes(value as EmploymentStatus) ? value as EmploymentStatus : fallback;
   }

   private normalizeEmploymentType(input: unknown, fallback: EmploymentType = DEFAULT_EMPLOYMENT_TYPE): EmploymentType {
     const value = (input ?? "").toString().trim();
     return EMPLOYMENT_TYPES.includes(value as EmploymentType) ? value as EmploymentType : fallback;
   }

   private normalizeEmploymentCategory(input: unknown): "Managerial" | "Non-Managerial" | null {
     const value = (input ?? "").toString().trim();
     return value === "Managerial" || value === "Non-Managerial" ? value : null;
   }

   private normalizeAssignedStartTime(input: unknown, fallback: "08:00" | "08:30" | "09:00" = "09:00"): "08:00" | "08:30" | "09:00" {
     const value = (input ?? "").toString().trim();
     return value === "08:00" || value === "08:30" || value === "09:00" ? value : fallback;
   }

   private normalizeScheduledWorkDays(input: unknown, fallback: number[] = [1, 2, 3, 4, 5]): number[] {
     const raw = Array.isArray(input) ? input : fallback;
     const days = Array.from(new Set(raw.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))).sort((a, b) => a - b);
     return days.length ? days : fallback;
   }

   private buildSalaryInfo(current: any, profile: any) {
     return {
       ...(current || {}),
       baseSalary: profile?.monthlySalary ?? current?.baseSalary ?? null,
       currency: profile?.salaryCurrency || current?.currency || "ETB",
     };
   }

   private normalizeApprovalFinancialInfo(input: any) {
     const data = input || {};
     const hasBaseSalary = data.baseSalary != null || data.monthlySalary != null || data.salary != null;
     const baseSalary = hasBaseSalary ? Number(data.baseSalary ?? data.monthlySalary ?? data.salary) : null;
     const netSalary = Number(data.netSalary ?? data.targetNetSalary ?? data.targetNetPay ?? data.netPay ?? 0);
     if ((baseSalary == null || !Number.isFinite(baseSalary) || baseSalary <= 0) && (!Number.isFinite(netSalary) || netSalary <= 0)) {
       throw new Error("Base salary or net salary is required before approval");
     }
     const pensionableSalary = Number(data.pensionableSalary ?? baseSalary ?? 0);
     if (data.pensionableSalary != null && (!Number.isFinite(pensionableSalary) || pensionableSalary < 0)) throw new Error("Pensionable salary must be valid");
     return {
       ...(baseSalary != null ? { baseSalary } : {}),
       ...(Number.isFinite(netSalary) && netSalary > 0 ? { netSalary } : {}),
       ...(data.pensionableSalary != null ? { pensionableSalary } : {}),
       currency: data.currency || "ETB",
       transportAllowance: Number(data.transportAllowance ?? 0),
       perDiemAllowance: Number(data.perDiemAllowance ?? 0),
       perDiemDays: Number(data.perDiemDays ?? 0),
       medicalBenefit: Number(data.medicalBenefit ?? 0),
       telecomAllowance: Number(data.telecomAllowance ?? 0),
       housingAllowance: Number(data.housingAllowance ?? 0),
       mealAllowance: Number(data.mealAllowance ?? 0),
       otherAllowance: Number(data.otherAllowance ?? 0),
       employeePensionRate: Number(data.employeePensionRate ?? 7),
       employerPensionRate: Number(data.employerPensionRate ?? 11),
       bankAccount: data.bankAccount || null,
       tin: data.tin || null,
       paymentStatus: data.paymentStatus || "Pending",
       remarks: data.remarks || null,
     };
   }

   private pendingRegistrationFinancialInfo(employeeRecord: any) {
     const salaryInfo = employeeRecord?.salaryInfo ?? {};
     const metadata = employeeRecord?.metadata ?? {};
     const primaryBank = Array.isArray(metadata.bankDetails) ? metadata.bankDetails[0] : null;
     return {
       bankName: primaryBank?.bankName ?? metadata.bankName ?? null,
       bankAccount: salaryInfo.bankAccount ?? primaryBank?.accountNumber ?? metadata.bankAccountNumber ?? null,
       tin: salaryInfo.tin ?? metadata.tin ?? metadata.taxIdentificationNumber ?? null,
       salaryInputMode: salaryInfo.salaryInputMode ?? null,
       baseSalary: salaryInfo.baseSalary ?? null,
       netSalary: salaryInfo.targetNetSalary ?? salaryInfo.netSalary ?? null,
       transportAllowance: salaryInfo.transportAllowance ?? null,
       perDiemAllowance: salaryInfo.perDiemAllowance ?? null,
       perDiemDays: salaryInfo.perDiemDays ?? null,
       medicalBenefit: salaryInfo.medicalBenefit ?? null,
       telecomAllowance: salaryInfo.telecomAllowance ?? null,
       housingAllowance: salaryInfo.housingAllowance ?? null,
       mealAllowance: salaryInfo.mealAllowance ?? null,
       otherAllowance: salaryInfo.otherAllowance ?? null,
       employeePensionRate: salaryInfo.employeePensionRate ?? null,
       employerPensionRate: salaryInfo.employerPensionRate ?? null,
       remarks: salaryInfo.remarks ?? null,
     };
   }

   private buildEmergencyContact(current: any, profile: any) {
     return {
       ...(current || {}),
       firstName: profile?.emergencyFirstName ?? current?.firstName ?? null,
       lastName: profile?.emergencyLastName ?? current?.lastName ?? null,
       phone: profile?.emergencyPhone ?? current?.phone ?? null,
       email: profile?.emergencyEmail ?? current?.email ?? null,
       city: profile?.emergencyCity ?? current?.city ?? null,
       country: profile?.emergencyCountry ?? current?.country ?? null,
     };
   }

   private buildEmployeeMetadata(current: any, profile: any, uploads: any) {
     return {
       ...(current || {}),
       dateOfBirth: profile?.dateOfBirth ?? current?.dateOfBirth ?? null,
       city: profile?.city ?? current?.city ?? null,
       countryOfBirth: profile?.countryOfBirth ?? current?.countryOfBirth ?? null,
       additionalPhone: profile?.additionalPhone ?? current?.additionalPhone ?? null,
       branch: profile?.branch ?? current?.branch ?? null,
       internship: {
         ...((current || {}).internship || {}),
         program: profile?.internshipProgram ?? current?.internship?.program ?? null,
         institution: profile?.internshipInstitution ?? current?.internship?.institution ?? null,
         mentorUserId: profile?.internshipMentorUserId ?? current?.internship?.mentorUserId ?? null,
         expectedEndDate: profile?.internshipExpectedEndDate ?? current?.internship?.expectedEndDate ?? null,
         status: profile?.internshipStatus ?? current?.internship?.status ?? null,
         stipendType: profile?.internshipStipendType ?? current?.internship?.stipendType ?? null,
       },
       bankDetails: profile?.bankDetails ?? current?.bankDetails ?? [],
       assetsAndCredentials: profile?.assetsAndCredentials ?? current?.assetsAndCredentials ?? [],
       additionalNotes: profile?.additionalNotes ?? current?.additionalNotes ?? null,
       uploads: { ...((current || {}).uploads || {}), ...(uploads || {}) },
     };
   }

   private async attachUploadsToProfile(params: { businessId: string; profileId: string; uploads: any; transaction: any }) {
     const { businessId, profileId, uploads, transaction } = params;
     if (!uploads || typeof uploads !== "object") return;

     for (const [key, value] of Object.entries(uploads)) {
       const fileAssetId = (value as any)?.id || (value as any)?.fileAssetId;
       if (!fileAssetId) continue;

       const existing = await db.EntityAttachment.findOne({
         where: { businessId, entityType: "business_user_profile", entityId: profileId, fileAssetId },
         transaction
       });
       if (existing) continue;

       await db.EntityAttachment.create({
         businessId,
         fileAssetId,
         entityType: "business_user_profile",
         entityId: profileId,
         moduleKey: "profiles",
         attachmentType: key
       }, { transaction });
     }
   }

   // Seed hook
   seedTemplates = async (req: Request, res: Response) => {
     await this.service.provisionTemplates(req.user!.businessId);
     successResponse(res, null, "Templates seeded successfully");
   };

   // Record Endpoints
   getRecord = async (req: Request, res: Response) => {
      try {
        // Target requested
        const targetUserId = req.params.userId || req.user!.id;
        const bId = req.user!.businessId;
        
        const rec = await this.service.getRecord(bId, targetUserId);
        if(!rec) return errorResponse(res, "Record not found", 404);

        // Security Validation (Salary filtering)
        const isSelf = req.user!.id === rec.userId;
        const canSeeSalary = req.user!.roles.some((r: string) => ['SUPER_ADMIN', 'BUSINESS_ADMIN', 'HR_MANAGER'].includes(r));
        
        const payload = rec.toJSON();
        if (!canSeeSalary) {
             delete payload.salaryInfo;
        }

        // Must be self, HR manager, admin, or department head
        if (!isSelf && !canSeeSalary) { 
           // Lock
        }

        successResponse(res, { employeeRecord: payload });
      } catch (e: any) { errorResponse(res, e.message); }
   };

   listRecords = async (req: Request, res: Response) => {
       try {
         const limit = Number(req.query.limit || 20);
         const offset = Number(req.query.offset || 0);
         const departmentId = req.query.departmentId as string;
         const employmentType = req.query.employmentType as string;
         const employmentStatus = req.query.employmentStatus as string;
         const q: any = { businessId: req.user!.businessId };
         
         if (departmentId) q.departmentId = departmentId;
         if (employmentType) q.employmentType = employmentType;
         if (employmentStatus) q.employmentStatus = employmentStatus;
         else q.employmentStatus = { [Op.ne]: 'terminated' };

         const result = await this.service.listRecords(q, limit, offset);
         const rowsWithFilteredSalaries = result.rows.map((r: any) => {
            const j = r.toJSON();
            const canSeeSalary = req.user!.roles.some((role: string) => ['SUPER_ADMIN', 'BUSINESS_ADMIN', 'HR_MANAGER'].includes(role));
            if(!canSeeSalary) delete j.salaryInfo;
            return j;
         });

         paginationResponse(res, rowsWithFilteredSalaries, result.count, offset/limit + 1, limit);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   validateBulkEmployeeRecords = async (req: Request, res: Response) => {
      try {
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        if (!Array.isArray(req.body?.rows)) return errorResponse(res, "rows must be an array", 400);
        const result = await this.bulkValidationService.validate(req.user!.businessId, rows);
        successResponse(res, result, "Bulk employee validation complete");
      } catch (e: any) {
        errorResponse(res, e.message);
      }
   };

   bulkWriteEmployeeRecords = async (req: Request, res: Response) => {
      try {
        if (!Array.isArray(req.body?.rows)) return errorResponse(res, "rows must be an array", 400);
        const result = await this.bulkValidationService.apply(req.user!.businessId, req.body.rows);
        successResponse(res, result, "Bulk employee write complete");
      } catch (e: any) {
        errorResponse(res, e.message);
      }
   };

   updateSelfRecord = async (req: Request, res: Response) => {
       try {
          const updates = { ...req.body };
          delete updates.salaryInfo;
          delete updates.departmentId;
          delete updates.positionId;
          delete updates.managerUserId;
          delete updates.employmentStatus;
          delete updates.employmentType;

          const rec = await this.service.getRecord(req.user!.businessId, req.user!.id);
          if(!rec) return errorResponse(res, "No record mapped");
          
          const u = await this.service.updateRecord(rec.id, req.user!.businessId, updates);
          successResponse(res, { employeeRecord: u });
       } catch (e: any) { errorResponse(res, e.message); }
   };

   updateEmployeeRecord = async (req: Request, res: Response) => {
     const transaction = await db.sequelize.transaction();
     try {
       const businessId = req.user!.businessId;
       const targetUserId = req.params.userId;
       const { account, profile, uploads } = req.body || {};

       const rec = await this.service.getRecord(businessId, targetUserId);
       if (!rec) {
         await transaction.rollback();
         return errorResponse(res, "Record not found", 404);
       }

       if (account) {
         const user = await db.User.findOne({ where: { id: targetUserId, businessId }, transaction });
         if (!user) {
           await transaction.rollback();
           return errorResponse(res, "User not found", 404);
         }

         if (account.email && account.email !== user.email) {
           const existing = await db.User.findOne({ where: { email: account.email, businessId }, transaction });
           if (existing && existing.id !== user.id) {
             await transaction.rollback();
             return errorResponse(res, "Email already in use", 400);
           }
         }

         const updateUser: any = {};
         if (account.firstName !== undefined || account.lastName !== undefined) {
           const parts = (user.fullName || "").trim().split(/\s+/).filter(Boolean);
           const currentFirst = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || "";
           const currentLast = parts.length > 1 ? parts.slice(-1).join(" ") : "";
           const nextFirst = (account.firstName ?? currentFirst ?? "").toString().trim();
           const nextLast = (account.lastName ?? currentLast ?? "").toString().trim();
           const nextFull = `${nextFirst} ${nextLast}`.trim();
           if (nextFull) updateUser.fullName = nextFull;
         }
         if (account.email !== undefined && account.email !== "") updateUser.email = account.email;
         if (account.phone !== undefined) updateUser.phone = account.phone || null;
         if (account.password) {
           const bcrypt = require("bcrypt");
           updateUser.password = await bcrypt.hash(account.password, 10);
         }

         if (Object.keys(updateUser).length > 0) {
           await user.update(updateUser, { transaction });
         }
       }

       if (profile || uploads !== undefined) {
         const recordUpdates: any = {};

         if (profile) {
           if (profile.employeeCode !== undefined) recordUpdates.employeeCode = profile.employeeCode || rec.employeeCode;
           if (profile.departmentId !== undefined) recordUpdates.departmentId = profile.departmentId || null;
           if (profile.positionId !== undefined) recordUpdates.positionId = profile.positionId || null;
           if (profile.reportingTo !== undefined) recordUpdates.managerUserId = profile.reportingTo || null;
           if (profile.employmentType !== undefined) recordUpdates.employmentType = profile.employmentType ? this.normalizeEmploymentType(profile.employmentType, rec.employmentType || DEFAULT_EMPLOYMENT_TYPE) : null;
           if (profile.employmentCategory !== undefined) recordUpdates.employmentCategory = this.normalizeEmploymentCategory(profile.employmentCategory);
           if (profile.assignedStartTime !== undefined) recordUpdates.assignedStartTime = this.normalizeAssignedStartTime(profile.assignedStartTime, rec.assignedStartTime || "09:00");
           if (profile.scheduledWorkDays !== undefined) recordUpdates.scheduledWorkDays = this.normalizeScheduledWorkDays(profile.scheduledWorkDays, rec.scheduledWorkDays || [1, 2, 3, 4, 5]);
           if (profile.employmentStatus !== undefined) recordUpdates.employmentStatus = this.normalizeEmploymentStatus(profile.employmentStatus, rec.employmentStatus || DEFAULT_EMPLOYMENT_STATUS);

           if (profile.startDate !== undefined) recordUpdates.hireDate = profile.startDate || rec.hireDate;
           if (profile.contractStartDate !== undefined) recordUpdates.contractStartDate = profile.contractStartDate || null;
           if (profile.contractEndDate !== undefined) recordUpdates.contractEndDate = profile.contractEndDate || null;
           if (profile.probationPeriod !== undefined) {
             const months = Number(profile.probationPeriod || 0);
             recordUpdates.probationEndDate = months
               ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30 * months)
               : null;
           }

           if (profile.monthlySalary !== undefined || profile.salaryCurrency !== undefined) {
             recordUpdates.salaryInfo = this.buildSalaryInfo(rec.salaryInfo || {}, {
               monthlySalary: profile.monthlySalary !== undefined ? profile.monthlySalary : rec.salaryInfo?.baseSalary,
               salaryCurrency: profile.salaryCurrency !== undefined ? profile.salaryCurrency : rec.salaryInfo?.currency,
             });
           }

           const emergencyProvided =
             profile.emergencyFirstName !== undefined ||
             profile.emergencyLastName !== undefined ||
             profile.emergencyPhone !== undefined ||
             profile.emergencyEmail !== undefined ||
             profile.emergencyCity !== undefined ||
             profile.emergencyCountry !== undefined;
           if (emergencyProvided) {
             recordUpdates.emergencyContact = this.buildEmergencyContact(rec.emergencyContact || {}, {
               emergencyFirstName: profile.emergencyFirstName !== undefined ? profile.emergencyFirstName : rec.emergencyContact?.firstName,
               emergencyLastName: profile.emergencyLastName !== undefined ? profile.emergencyLastName : rec.emergencyContact?.lastName,
               emergencyPhone: profile.emergencyPhone !== undefined ? profile.emergencyPhone : rec.emergencyContact?.phone,
               emergencyEmail: profile.emergencyEmail !== undefined ? profile.emergencyEmail : rec.emergencyContact?.email,
               emergencyCity: profile.emergencyCity !== undefined ? profile.emergencyCity : rec.emergencyContact?.city,
               emergencyCountry: profile.emergencyCountry !== undefined ? profile.emergencyCountry : rec.emergencyContact?.country,
             });
           }

           recordUpdates.metadata = this.buildEmployeeMetadata(rec.metadata || {}, {
             dateOfBirth: profile.dateOfBirth !== undefined ? profile.dateOfBirth : rec.metadata?.dateOfBirth,
             city: profile.city !== undefined ? profile.city : rec.metadata?.city,
             countryOfBirth: profile.countryOfBirth !== undefined ? profile.countryOfBirth : rec.metadata?.countryOfBirth,
             additionalPhone: profile.additionalPhone !== undefined ? profile.additionalPhone : rec.metadata?.additionalPhone,
             branch: profile.branch !== undefined ? profile.branch : rec.metadata?.branch,
             internshipProgram: profile.internshipProgram !== undefined ? profile.internshipProgram : rec.metadata?.internship?.program,
             internshipInstitution: profile.internshipInstitution !== undefined ? profile.internshipInstitution : rec.metadata?.internship?.institution,
             internshipMentorUserId: profile.internshipMentorUserId !== undefined ? profile.internshipMentorUserId : rec.metadata?.internship?.mentorUserId,
             internshipExpectedEndDate: profile.internshipExpectedEndDate !== undefined ? profile.internshipExpectedEndDate : rec.metadata?.internship?.expectedEndDate,
             internshipStatus: profile.internshipStatus !== undefined ? profile.internshipStatus : rec.metadata?.internship?.status,
             internshipStipendType: profile.internshipStipendType !== undefined ? profile.internshipStipendType : rec.metadata?.internship?.stipendType,
             bankDetails: profile.bankDetails !== undefined ? profile.bankDetails : rec.metadata?.bankDetails,
             assetsAndCredentials: profile.assetsAndCredentials !== undefined ? profile.assetsAndCredentials : rec.metadata?.assetsAndCredentials,
             additionalNotes: profile.additionalNotes !== undefined ? profile.additionalNotes : rec.metadata?.additionalNotes,
           }, uploads);
         } else if (uploads !== undefined) {
           const currentUploads = (rec.metadata || {}).uploads || {};
           recordUpdates.metadata = { ...(rec.metadata || {}), uploads: { ...(currentUploads || {}), ...(uploads || {}) } };
         }

         if (Object.keys(recordUpdates).length > 0) {
           await rec.update(recordUpdates, { transaction });
         }

         const businessProfile = await db.BusinessUserProfile.findOne({ where: { businessId, userId: targetUserId }, transaction });
         if (businessProfile) {
           const bpUpdates: any = {};
           if (profile?.employeeCode !== undefined) bpUpdates.employeeCode = profile.employeeCode || businessProfile.employeeCode;
           if (profile?.departmentId !== undefined) bpUpdates.departmentId = profile.departmentId || null;
           if (profile?.positionId !== undefined) bpUpdates.positionId = profile.positionId || null;
           if (account?.email !== undefined && account.email !== "") bpUpdates.workEmail = account.email;
           if (account?.phone !== undefined) bpUpdates.workPhone = account.phone || null;
           if (profile?.employmentType !== undefined) bpUpdates.employmentType = profile.employmentType ? this.normalizeEmploymentType(profile.employmentType, businessProfile.employmentType || DEFAULT_EMPLOYMENT_TYPE) : null;
           if (profile?.startDate !== undefined) bpUpdates.joinedAt = profile.startDate || businessProfile.joinedAt;
           if (profile?.systemRole !== undefined) {
             const settings = { ...(businessProfile.settings || {}) };
             settings.systemRole = this.normalizeSystemRoleKey(profile.systemRole);
             bpUpdates.settings = settings;
           }
           if (Object.keys(bpUpdates).length > 0) await businessProfile.update(bpUpdates, { transaction });
           await this.attachUploadsToProfile({ businessId, profileId: businessProfile.id, uploads, transaction });
         }
       }

       if (profile?.systemRole !== undefined) {
         const systemRoleKey = this.normalizeSystemRoleKey(profile.systemRole);

         const targetUser = await db.User.findOne({
           where: { id: targetUserId, businessId },
           include: [{ model: db.Role, through: { attributes: [] } }],
           transaction
         });

           if (targetUser) {
             const nextRole =
               (await db.Role.findOne({ where: { businessId, key: systemRoleKey }, transaction })) ||
               (await db.Role.findOne({ where: { businessId: null, key: systemRoleKey }, transaction }));

           if (nextRole) {
             const systemRoleKeys = [
               "HR_MANAGER",
               "FINANCE_MANAGER",
               "CRM_MANAGER",
               "PROJECT_MANAGER",
               "DEPARTMENT_HEAD",
               "EMPLOYEE",
               "CLIENT"
             ];

             const existingRoles = ((targetUser as any).Roles || []) as any[];
             const preservedRoles = existingRoles.filter((r) => !systemRoleKeys.includes(r.key));
             const merged = [...preservedRoles, nextRole];

             const byId = new Map<string, any>();
             for (const r of merged) byId.set(r.id, r);

             await targetUser.setRoles(Array.from(byId.values()), { transaction });
           }
         }
       }

       await transaction.commit();
       successResponse(res, { employeeRecord: rec });
     } catch (e: any) {
       await transaction.rollback();
       errorResponse(res, e.message);
     }
   };

    onboardEmployee = async (req: Request, res: Response) => {
        const transaction = await db.sequelize.transaction();
        try {
          const { account, profile: rawProfile, uploads, offerLetterTemplateId } = req.body;
          const profile = rawProfile || {};
           const businessId = req.user!.businessId;
           
           if (!account || !account.email || !account.password || !account.firstName || !account.lastName) {
              await transaction.rollback();
              return errorResponse(res, "Account info missing (email, password, firstName, lastName)", 400);
           }

           // 1. Manage User Account (check soft-deleted users too)
           let targetUser = await db.User.findOne({ where: { email: account.email, businessId }, transaction });
           if (!targetUser) {
              // Check if user was previously soft-deleted
              const deletedUser = await db.User.findOne({ where: { email: account.email, businessId }, transaction, paranoid: false });
              if (deletedUser) {
                // Restore the soft-deleted user
                await deletedUser.restore({ transaction });
                const bcrypt = require('bcrypt');
                const hash = await bcrypt.hash(account.password, 10);
                await deletedUser.update({
                  fullName: `${account.firstName} ${account.lastName}`,
                  password: hash,
                  phone: account.phone || null,
                  status: 'inactive'
                }, { transaction });
                targetUser = deletedUser;
              } else {
                const bcrypt = require('bcrypt');
                const hash = await bcrypt.hash(account.password, 10);
                targetUser = await db.User.create({
                    id: require('crypto').randomUUID(),
                    businessId,
                    fullName: `${account.firstName} ${account.lastName}`,
                    email: account.email,
                    password: hash,
                    phone: account.phone || null,
                    status: 'inactive'
                }, { transaction });
              }
           }

           // 2. Manage Employee Profile
           const empRec = await this.service.getRecord(businessId, targetUser.id);
           if (empRec) {
              await transaction.rollback();
              return errorResponse(res, "Employee record already exists for this user", 400);
           }

           // Ensure the user's system role is reflected in auth (/me) by syncing Roles.
           {
             const systemRoleKey = this.normalizeSystemRoleKey(profile?.systemRole);
             const role =
               (await db.Role.findOne({ where: { businessId, key: systemRoleKey }, transaction })) ||
               (await db.Role.findOne({ where: { businessId: null, key: systemRoleKey }, transaction })) ||
               (await db.Role.findOne({ where: { businessId, key: "EMPLOYEE" }, transaction })) ||
               (await db.Role.findOne({ where: { businessId: null, key: "EMPLOYEE" }, transaction }));

             if (role) {
               await targetUser.setRoles([role], { transaction });
             }
           }

           const recordData = {
               businessId,
               userId: targetUser.id,
               employeeCode: profile.employeeCode || `EMP-${Date.now().toString().slice(-4)}`,
               departmentId: profile.departmentId || null,
               positionId: profile.positionId || null,
               managerUserId: profile.reportingTo || null,
               employmentType: this.normalizeEmploymentType(profile?.employmentType, DEFAULT_EMPLOYMENT_TYPE),
               employmentCategory: this.normalizeEmploymentCategory(profile?.employmentCategory),
               assignedStartTime: this.normalizeAssignedStartTime(profile?.assignedStartTime),
               scheduledWorkDays: this.normalizeScheduledWorkDays(profile?.scheduledWorkDays),
               employmentStatus: this.normalizeEmploymentStatus(profile?.employmentStatus, DEFAULT_EMPLOYMENT_STATUS),
               hireDate: profile.startDate || new Date(),
               contractStartDate: profile.contractStartDate || profile.startDate || null,
               contractEndDate: profile.contractEndDate || null,
               probationEndDate: profile.probationPeriod ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30 * parseInt(profile.probationPeriod)) : null,
               salaryInfo: this.buildSalaryInfo({}, profile),
               emergencyContact: this.buildEmergencyContact({}, profile),
               metadata: this.buildEmployeeMetadata({}, profile, uploads)
           };

           // Check for soft-deleted employee record and restore it
           let newRecord;
           const deletedEmpRec = await db.EmployeeRecord.findOne({ where: { userId: targetUser.id, businessId }, transaction, paranoid: false });
           if (deletedEmpRec) {
              await deletedEmpRec.restore({ transaction });
              await deletedEmpRec.update(recordData, { transaction });
              newRecord = deletedEmpRec;
           } else {
              newRecord = await db.EmployeeRecord.create(recordData, { transaction });
           }

           // 3. Create or restore Business User Profile link
           const deletedProfile = await db.BusinessUserProfile.findOne({ where: { userId: targetUser.id, businessId }, transaction, paranoid: false });
           let businessProfile;
           if (deletedProfile) {
              if (deletedProfile.deletedAt) await deletedProfile.restore({ transaction });
              businessProfile = await deletedProfile.update({
                  employeeCode: recordData.employeeCode,
                  departmentId: recordData.departmentId,
                  positionId: recordData.positionId,
                  workEmail: account.email,
                  workPhone: account.phone,
                  employmentType: recordData.employmentType,
                  joinedAt: recordData.hireDate
              }, { transaction });
           } else {
              businessProfile = await db.BusinessUserProfile.create({
                  businessId,
                  userId: targetUser.id,
                  employeeCode: recordData.employeeCode,
                  departmentId: recordData.departmentId,
                  positionId: recordData.positionId,
                  workEmail: account.email,
                  workPhone: account.phone,
                  employmentType: recordData.employmentType,
                  joinedAt: recordData.hireDate
              }, { transaction });
           }

           await this.attachUploadsToProfile({ businessId, profileId: businessProfile.id, uploads, transaction });

           // 4. Offer Letter Automation
           if (offerLetterTemplateId) {
             const template = await db.OfferLetterTemplate.findOne({ where: { id: offerLetterTemplateId, businessId }, transaction });
             if (template) {
               const pos = await db.Position.findByPk(profile.positionId, { transaction });
               const dept = await db.Department.findByPk(profile.departmentId, { transaction });
               const biz = await db.Business.findByPk(businessId, { transaction });
               
               const systemRoleKey = this.normalizeSystemRoleKey(profile?.systemRole);
               let role = await db.Role.findOne({ where: { businessId, key: systemRoleKey }, transaction });
               if (!role) {
                 role = await db.Role.findOne({ where: { businessId, key: "EMPLOYEE" }, transaction });
                 if (!role) {
                   role = await db.Role.findOne({ where: { businessId }, transaction }); 
                 }
               }

               const renderData: any = {
                  ...profile,
                  firstName: account.firstName,
                  lastName: account.lastName,
                  fullName: `${account.firstName} ${account.lastName}`,
                  name: `${account.firstName} ${account.lastName}`,
                  email: account.email,
                  startDate: profile.startDate || 'TBD',
                  salary: profile.monthlySalary || 'TBD',
                  monthlySalary: profile.monthlySalary || 'TBD',
                  position: pos?.title || 'Staff',
                  positionTitle: pos?.title || 'Staff',
                  department: dept?.name || 'General',
                  businessName: biz?.name || 'Blih ERP'
               };

               const letter = await db.OfferLetter.create({
                 businessId,
                 templateId: template.id,
                 candidateName: renderData.fullName,
                 candidateEmail: account.email,
                 positionId: profile.positionId,
                 departmentId: profile.departmentId,
                 roleId: role?.id || null,
                 salary: profile.monthlySalary?.toString() || '0',
                 startDate: profile.startDate || new Date(),
                 employmentType: this.normalizeEmploymentType(profile?.employmentType, DEFAULT_EMPLOYMENT_TYPE),
                 renderedSubject: '', 
                 renderedHtml: '', 
                 renderedText: '', 
                 createdById: req.user!.id,
                 status: 'SENT',
                 sentAt: new Date()
               }, { transaction });

               const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
               const acceptUrl = `${backendUrl}/api/v1/hr/public/offers/${letter.id}/accept`;
               const finalRenderData = { ...renderData, acceptUrl };
               
               const renderedHtml = renderOfferLetter(template.bodyHtml, finalRenderData);
               const renderedText = renderOfferLetter(template.bodyText, finalRenderData);
               const renderedSubject = renderOfferLetter(template.subject, finalRenderData);

               // Failsafe: Ensure candidate has an acceptance button even if template is missing {{acceptUrl}}
               let finalHtml = renderedHtml.renderedContent;
               if (!finalHtml.includes(acceptUrl)) {
                 finalHtml += `
                   <div style="margin-top:40px;padding-top:24px;border-top:1px solid #e2e8f0;text-align:center;font-family:Arial,sans-serif;">
                     <p style="color:#64748b;font-size:14px;margin-bottom:20px;">
                       To officially accept this job offer, please click the button below:
                     </p>
                     <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                       <tr>
                         <td style="border-radius:8px;background:#2563eb;">
                           <a href="${acceptUrl}"
                              target="_blank"
                              style="display:inline-block;padding:14px 32px;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;background:#2563eb;border:1px solid #2563eb;mso-padding-alt:0;text-align:center;">
                             ✓ Accept Job Offer
                           </a>
                         </td>
                       </tr>
                     </table>
                     <p style="color:#94a3b8;font-size:12px;margin-top:16px;">
                       Or copy this link: <a href="${acceptUrl}" style="color:#2563eb;">${acceptUrl}</a>
                     </p>
                   </div>
                 `;
               }

               await letter.update({
                 renderedSubject: renderedSubject.renderedContent,
                 renderedHtml: finalHtml,
                 renderedText: renderedText.renderedContent
               }, { transaction });

               try {
                 const pdfPath = await generateOfferLetterPdf(finalHtml, businessId, letter.id);
                 await letter.update({ pdfPath }, { transaction });
                 await sendOfferLetterEmail(account.email, renderedSubject.renderedContent, finalHtml, renderedText.renderedContent, pdfPath, businessId);
               } catch (emailErr) {
                 console.error("Failed to generate/send automated offer letter", emailErr);
               }
             }
           }

           await transaction.commit();
           successResponse(res, { employeeRecord: newRecord });
        } catch (e: any) { 
           if (transaction) await transaction.rollback();
           const message = e.name === 'SequelizeValidationError' || e.name === 'SequelizeUniqueConstraintError' 
               ? e.errors.map((err: any) => err.message).join(', ') 
               : e.message;
           errorResponse(res, message, 400, e.errors); 
        }
    };

    deleteRecord = async (req: Request, res: Response) => {
        try {
            const userId = req.params.userId;
            await this.service.deleteRecord(req.user!.businessId, userId);
            successResponse(res, null, "Employee record deleted successfully");
        } catch (e: any) {
            errorResponse(res, e.message);
        }
    };

    getOrganogram = async (req: Request, res: Response) => {
        try {
            const tree = await this.service.getOrganogram(req.user!.businessId);
            successResponse(res, { tree });
        } catch (e: any) {
            errorResponse(res, e.message);
        }
    };

    // ── Pending Registrations — HR Approval Workflow ──────────────────────────

    /**
     * GET /api/v1/hr/pending-registrations
     * List users with status 'pending' or 'rejected' for HR review.
     */
    listPendingRegistrations = async (req: Request, res: Response) => {
        try {
            const businessId = req.user!.businessId;
            const status = (req.query.status as string) || 'pending';
            const page   = Math.max(1, parseInt(req.query.page as string) || 1);
            const size   = Math.min(100, parseInt(req.query.size as string) || 20);
            const offset = (page - 1) * size;

            const { Op } = require('sequelize');
            const allowedStatuses = ['pending', 'rejected'];
            const whereStatus = allowedStatuses.includes(status) ? status : 'pending';

            const { count, rows } = await db.User.findAndCountAll({
                where: { businessId, status: whereStatus },
                attributes: ['id', 'fullName', 'email', 'phone', 'status', 'createdAt', 'rejectionReason', 'rejectedAt'],
                include: [{
                    model: db.BusinessUserProfile,
                    as: 'BusinessUserProfile',
                    attributes: ['settings', 'departmentId', 'positionId', 'employmentType', 'joinedAt'],
                    include: [
                        { model: db.Department, as: 'department', attributes: ['id', 'name'] },
                        { model: db.Position,   as: 'position',   attributes: ['id', 'title'] },
                    ],
                }],
                order: [['createdAt', 'DESC']],
                limit: size,
                offset,
            });

            const employeeRecords = await db.EmployeeRecord.findAll({
                where: { businessId, userId: { [Op.in]: rows.map((u: any) => u.id) } },
                attributes: ['userId', 'salaryInfo', 'metadata'],
            });
            const employeeRecordByUserId = new Map(employeeRecords.map((record: any) => [record.userId, record]));

            const items = rows.map((u: any) => {
                const profile  = u.BusinessUserProfile;
                const settings = profile?.settings ?? {};
                const employeeRecord = employeeRecordByUserId.get(u.id);
                return {
                    id:               u.id,
                    fullName:         u.fullName,
                    email:            u.email,
                    phone:            u.phone,
                    status:           u.status,
                    createdAt:        u.createdAt,
                    rejectionReason:  u.rejectionReason,
                    rejectedAt:       u.rejectedAt,
                    requestedRoleKey: settings.requestedRoleKey || null,
                    employmentType:   profile?.employmentType   || settings.employmentType || null,
                    hireDate:         profile?.joinedAt         || null,
                    department:       profile?.department       || null,
                    position:         profile?.position         || null,
                    financial:         this.pendingRegistrationFinancialInfo(employeeRecord),
                    personal: {
                        dateOfBirth:   settings.dateOfBirth   || null,
                        gender:        settings.gender        || null,
                        maritalStatus: settings.maritalStatus || null,
                        nationality:   settings.nationality   || null,
                        address:       settings.address       || null,
                        city:          settings.city          || null,
                        country:       settings.country       || null,
                        zipCode:       settings.zipCode       || null,
                    },
                };
            });

            successResponse(res, { items, total: count, page, size, pages: Math.ceil(count / size) });
        } catch (e: any) {
            errorResponse(res, e.message);
        }
    };

    /**
     * GET /api/v1/hr/pending-registrations/:userId
     * Full detail of one pending/rejected user for the HR review modal.
     */
    getPendingRegistration = async (req: Request, res: Response) => {
        try {
            const businessId = req.user!.businessId;
            const { Op } = require('sequelize');

            const user = await db.User.findOne({
                where: { id: req.params.userId, businessId, status: { [Op.in]: ['pending', 'rejected'] } },
                attributes: { exclude: ['password'] },
                include: [{
                    model: db.BusinessUserProfile,
                    as: 'BusinessUserProfile',
                    include: [
                        { model: db.Department, as: 'department', attributes: ['id', 'name'] },
                        { model: db.Position,   as: 'position',   attributes: ['id', 'title'] },
                    ],
                }, {
                    model: db.EmployeeRecord,
                    // User hasMany EmployeeRecord — Sequelize uses the plural alias
                    attributes: ['id', 'metadata', 'salaryInfo', 'emergencyContact', 'departmentId', 'positionId', 'employmentType', 'hireDate'],
                    required: false,
                    limit: 1,
                    order: [['createdAt', 'DESC']],
                }],
            });

            if (!user) return errorResponse(res, 'Not found', 404);

            // Flatten so the frontend can access EmployeeRecord directly
            const plain = user.toJSON ? user.toJSON() : user;
            const empRecord = (plain.EmployeeRecords ?? [])[0] ?? null;

            successResponse(res, {
                user: {
                    ...plain,
                    EmployeeRecord: empRecord,
                    EmployeeRecords: undefined,
                    financial: this.pendingRegistrationFinancialInfo(empRecord),
                },
            });
        } catch (e: any) {
            errorResponse(res, e.message);
        }
    };

    /**
     * POST /api/v1/hr/pending-registrations/:userId/approve
     * Approve a pending registration. Activates account and assigns role.
     */
    approveRegistration = async (req: Request, res: Response) => {
        try {
            const businessId = req.user!.businessId;
            const { Op } = require('sequelize');
            const { sendApprovalEmail } = require('../../services/registrationEmails');

            const user = await db.User.findOne({
                where: { id: req.params.userId, businessId, status: { [Op.in]: ['pending', 'rejected'] } },
            });
            if (!user) return errorResponse(res, 'Not found', 404);
            if (req.body?.financialConfirmation !== true) {
                return errorResponse(res, 'Confirm the financial information before approval', 400);
            }
            let financialInfo: any;
            try {
                financialInfo = this.normalizeApprovalFinancialInfo(req.body?.financialInfo);
            } catch (validationError: any) {
                return errorResponse(res, validationError.message, 400);
            }
            const employeeRecord = await db.EmployeeRecord.findOne({ where: { businessId, userId: user.id } });
            if (!employeeRecord) return errorResponse(res, 'Employee record is required before approval', 400);

            await user.update({
                status:          'active',
                rejectionReason: null,
                rejectedAt:      null,
                approvedAt:      new Date(),
                approvedByUserId: req.user!.id,
            });

            await db.BusinessUserProfile.update(
                { status: 'active' },
                { where: { userId: user.id } },
            );

            // Assign requested role
            const profile  = await db.BusinessUserProfile.findOne({ where: { userId: user.id } });
            const settings = profile?.settings ?? {};
            const roleKey  = settings.requestedRoleKey || 'EMPLOYEE';
            const role     = await db.Role.findOne({ where: { key: roleKey.toUpperCase(), businessId: null } });
            if (role) await user.setRoles([role]).catch(() => null);

            if (settings.onboardingId) {
                const onboarding = await db.CandidateOnboarding.findOne({ where: { onboardingId: settings.onboardingId, businessId } });
                if (onboarding) {
                    await onboarding.update({ status: 'COMPLETED' });
                    await db.EmployeeRecord.update(
                        { employmentStatus: 'active' },
                        { where: { userId: user.id, businessId } },
                    );
                    await db.InventoryItem.update(
                        {
                            status: 'ASSIGNED',
                            assignedToUserId: user.id,
                            reservedForOnboardingId: null,
                        },
                        { where: { businessId, reservedForOnboardingId: onboarding.id } },
                    );
                }
            }

            const payroll = await this.payrollTemplateService.setupAutomaticEthiopianPayroll(
                businessId,
                req.user!.id,
                user.id,
                financialInfo,
            );

            // Send approval email (non-fatal)
            const business = await db.Business.findByPk(businessId, { attributes: ['name'] });
            sendApprovalEmail({ toEmail: user.email, toName: user.fullName, businessName: business?.name || '' }).catch(() => null);

            successResponse(res, { approved: true, userId: user.id, payroll });
        } catch (e: any) {
            errorResponse(res, e.message);
        }
    };

    /**
     * POST /api/v1/hr/pending-registrations/:userId/reject
     * Reject a pending registration with reason and optional template message.
     * Sends a resubmit email to the applicant.
     */
    rejectRegistration = async (req: Request, res: Response) => {
        try {
            const businessId = req.user!.businessId;
            const { Op } = require('sequelize');
            const { sendRejectionEmail } = require('../../services/registrationEmails');

            const { reason, templateMessage } = req.body;
            if (!reason?.trim()) return errorResponse(res, 'Rejection reason is required', 400);

            const user = await db.User.findOne({
                where: { id: req.params.userId, businessId, status: { [Op.in]: ['pending', 'rejected'] } },
            });
            if (!user) return errorResponse(res, 'Not found', 404);

            await user.update({
                status:          'rejected',
                rejectionReason: reason.trim(),
                rejectedAt:      new Date(),
            });

            await db.BusinessUserProfile.update(
                { status: 'rejected' },
                { where: { userId: user.id } },
            );

            // Send rejection email with resubmit link
            const business = await db.Business.findByPk(businessId, { attributes: ['name', 'slug'] });
            if (user.registrationToken && business) {
                sendRejectionEmail({
                    toEmail:           user.email,
                    toName:            user.fullName,
                    businessName:      business.name,
                    businessSlug:      business.slug,
                    registrationToken: user.registrationToken,
                    reason:            reason.trim(),
                    templateMessage:   templateMessage?.trim() || undefined,
                }).catch(() => null);
            }

            successResponse(res, { rejected: true, userId: user.id });
        } catch (e: any) {
            errorResponse(res, e.message);
        }
    };
}
