import type { Request, Response, NextFunction } from "express";
import { ok } from "../../utils/apiResponse";
import { AuditLogService } from "../../services/auditLog.service";
import { ProfileTemplateService } from "./profileTemplate.service";

export class ProfileTemplateController {
  private service = new ProfileTemplateService();

  list = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    let templates = await this.service.list(businessId);

    const fullEmployeeFields = [
      // Account Setup
      { name: "firstName", label: "First Name", componentType: "input", required: true, placeholder: "Jessica" },
      { name: "lastName", label: "Last Name", componentType: "input", required: true, placeholder: "Parker" },
      { name: "email", label: "Email Address", componentType: "input", required: true, placeholder: "alexg@gmail.com" },
      { name: "phone", label: "Phone Number", componentType: "input", required: false, placeholder: "+251 922 76 6767" },
      { name: "password", label: "Initial Password", componentType: "input", required: true, placeholder: "••••••••" },
      
      // Employment Details
      { name: "employeeCode", label: "Employee Code", componentType: "input", required: false, placeholder: "Leave empty to auto-generate" },
      { name: "systemRole", label: "System Role", componentType: "select", required: true, options: [{label: "Employee", value: "EMPLOYEE"}, {label: "Manager", value: "MANAGER"}, {label: "HR Manager", value: "HR_MANAGER"}] },
      { name: "departmentId", label: "Department ID", componentType: "input", required: true },
      { name: "positionId", label: "Position ID", componentType: "input", required: true },
      { name: "reportingTo", label: "Reporting To (User ID)", componentType: "input", required: false },
      { name: "startDate", label: "Start Date", componentType: "date", required: false },
      { name: "monthlySalary", label: "Monthly Salary", componentType: "input", required: false, placeholder: "e.g. 15000" },
      { name: "probationPeriod", label: "Probation Period (Months)", componentType: "input", required: false, placeholder: "3" },
      
      // Personal & Bank
      { name: "dateOfBirth", label: "Date of Birth", componentType: "date", required: false },
      { name: "city", label: "City of Residence", componentType: "input", required: false },
      { name: "countryOfBirth", label: "Country of Birth", componentType: "input", required: false },
      { name: "bankName", label: "Bank Name", componentType: "input", required: false },
      { name: "bankAccountNumber", label: "Bank Account Number", componentType: "input", required: false },
      
      // Emergency Contact
      { name: "emergencyFirstName", label: "Emergency Contact First Name", componentType: "input", required: false },
      { name: "emergencyLastName", label: "Emergency Contact Last Name", componentType: "input", required: false },
      { name: "emergencyPhone", label: "Emergency Contact Phone", componentType: "input", required: false },
      { name: "emergencyEmail", label: "Emergency Contact Email", componentType: "input", required: false },
      { name: "emergencyCity", label: "Emergency Contact City", componentType: "input", required: false },
      { name: "emergencyCountry", label: "Emergency Contact Country", componentType: "input", required: false },
      
      // Notes
      { name: "additionalNotes", label: "Additional Notes", componentType: "textarea", required: false }
    ];

    const basicTemplate = templates.find(t => t.name.includes("Basic Employee Profile"));
    if (basicTemplate && (basicTemplate.fields?.length || 0) < 10) {
      // Template exists but is outdated, update it
      await this.service.update(basicTemplate.id, businessId, { fields: fullEmployeeFields });
      templates = await this.service.list(businessId);
    } else if (!templates.length) {
      // Minimal seed so the UI has something to start with.
      const seeded = await Promise.all([
        this.service.create(businessId, {
          name: "Basic Employee Profile",
          description: "Full profile for employee onboarding.",
          fields: fullEmployeeFields
        }),
        this.service.create(businessId, {
          name: "Contractor Profile",
          description: "Lightweight profile for contractors and temporary staff.",
          fields: [
            { name: "firstName", label: "First Name", componentType: "input", required: true },
            { name: "lastName", label: "Last Name", componentType: "input", required: true },
            { name: "email", label: "Email Address", componentType: "input", required: true },
            {
              name: "contractType",
              label: "Contract Type",
              componentType: "select",
              required: true,
              options: [
                { label: "Contract", value: "contract" },
                { label: "Part-time", value: "part_time" },
                { label: "Consultant", value: "consultant" }
              ]
            },
            { name: "startDate", label: "Start Date", componentType: "date", required: true },
            { name: "notes", label: "Notes", componentType: "textarea", required: false, placeholder: "Any additional details..." }
          ]
        })
      ]);
      templates = seeded;
    }
    return ok(res, { templates }, "Profile templates");
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = req.user!.businessId;
    const template = await this.service.getById(req.params.id, businessId);
    if (!template) return next({ statusCode: 404, message: "Not found" });
    return ok(res, { template }, "Profile template");
  };

  create = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const template = await this.service.create(businessId, req.body);
    await AuditLogService.log("CREATE", "profile_template", template.id, null, template, req);
    return ok(res, { template }, "Profile template created", 201);
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = req.user!.businessId;
    const before = await this.service.getById(req.params.id, businessId);
    const template = await this.service.update(req.params.id, businessId, req.body);
    if (!template) return next({ statusCode: 404, message: "Not found" });
    await AuditLogService.log("UPDATE", "profile_template", req.params.id, before, template, req);
    return ok(res, { template }, "Profile template updated");
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = req.user!.businessId;
    const before = await this.service.getById(req.params.id, businessId);
    const deleted = await this.service.remove(req.params.id, businessId);
    if (!deleted) return next({ statusCode: 404, message: "Not found" });
    await AuditLogService.log("DELETE", "profile_template", req.params.id, before, null, req);
    return ok(res, { ok: true }, "Profile template deleted");
  };
}
