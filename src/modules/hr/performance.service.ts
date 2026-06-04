
import { db } from '../../models';
import { INACTIVE_EMPLOYMENT_STATUS, TERMINATED_EMPLOYMENT_STATUS } from '../../constants/employee.constants';

export class HRPerformanceService {
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

  async processExit(businessId: string, employeeUserId: string, exitId: string, status: string) {
     const p = await db.ExitProcess.findOne({ where: { id: exitId, businessId, employeeUserId } });
     if(!p) throw new Error("Exit Process not mapping natively.");
     
     if (status === 'completed') {
        const emp = await db.EmployeeRecord.findOne({ where: { businessId, userId: employeeUserId } });
        if (emp) await emp.update({ employmentStatus: TERMINATED_EMPLOYMENT_STATUS });
        // Normally disable db.User connection access implicitly here
     } else if (status === 'in_progress') {
        const emp = await db.EmployeeRecord.findOne({ where: { businessId, userId: employeeUserId } });
        if (emp) await emp.update({ employmentStatus: INACTIVE_EMPLOYMENT_STATUS });
     }
     return p.update({ status });
  }

  async restrictDisciplinaryAccess(businessId: string, requestingUser: any) {
     // A generic bounding utility structurally resolving HR mapping roles 
     const isHRAdmin = requestingUser.roles.some((role: string) => ['SUPER_ADMIN', 'BUSINESS_ADMIN', 'HR_MANAGER'].includes(role));
     if (!isHRAdmin) {
        throw new Error("Strict structural isolation prevents non-HR operators resolving sensitive disciplinary cases.");
     }
  }
}
