
import { TemplateDAL } from './template.dal';
import { db } from '../../models';

export class TemplateService {
  private dal = new TemplateDAL();

  listAll() {
    return this.dal.findAll({});
  }

  async applyTemplate(businessId: string, moduleKey: string, reapply: boolean = false) {
    // 1. Validate template exists
    const tpl = await this.dal.findByKey(moduleKey);
    if (!tpl) throw new Error(`Template for module '${moduleKey}' not found.`);

    // 2. We don't block applying, but we shouldn't apply unless the module is active. 
    // Handled in controller / logic based on roles. We assume valid business.
    // 3. Apply Workflows
    for (const w of tpl.workflows) {
      const existing = await db.ApprovalWorkflow.findOne({ where: { businessId, key: w.workflowKey, moduleKey }});
      if (existing && !reapply) continue; // Skip duplicate
      
      let wfId = existing?.id;
      if (!existing) {
        const nw = await db.ApprovalWorkflow.create({
          businessId, moduleKey, entityType: 'form_submission',
          name: w.workflowName, key: w.workflowKey,
          description: w.workflowSchema.description || '',
          status: 'active'
        });
        wfId = nw.id;
        
        // Load default steps
        if (w.defaultSteps && Array.isArray(w.defaultSteps)) {
          for (const step of w.defaultSteps) {
            await db.ApprovalStep.create({
              businessId, workflowId: wfId,
              stepOrder: step.stepOrder,
              approverType: step.approverType,
              actionRequired: step.actionRequired || 'any',
              isFinalStep: step.isFinalStep || false
            });
          }
        }
      }
    }

    // 4. Apply Forms
    for (const f of tpl.forms) {
      const existing = await db.FormDefinition.findOne({ where: { businessId, key: f.formKey, moduleKey } });
      if (existing && !reapply) continue;

      let fdId = existing?.id;
      if (!existing) {
        const nf = await db.FormDefinition.create({
          businessId, moduleKey, name: f.formName, key: f.formKey,
          description: f.formSchema.description || '',
          requiresApproval: f.formSchema.requiresApproval || false,
          status: 'active'
        });
        fdId = nf.id;

        // Note: Realistically, you would link the form to the newly created workflowId if requiresApproval is true
        // Simplifying the map for MVP.

        if (f.defaultFields && Array.isArray(f.defaultFields)) {
          for (const field of f.defaultFields) {
            await db.FormField.create({
              businessId, formDefinitionId: fdId,
              label: field.label, key: field.key, type: field.type,
              required: field.required || false,
              options: field.options || [],
              orderIndex: field.orderIndex || 0
            });
          }
        }
      }
    }

    return true;
  }

  async seedGlobalTemplates() {
    const defaultTemplates = [
      {
        moduleKey: 'finance', name: 'Accounting & Finance',
        forms: [
          { formKey: 'invoice_create', formName: 'Invoice Creation Form', fields: [{label: 'Client ID', key: 'client', type: 'text', required: true}] },
          { formKey: 'milestone_bill', formName: 'Milestone Billing Form', fields: [{label: 'Milestone Percent', key: 'percent', type: 'number', required: true}] },
          { formKey: 'payment_coll', formName: 'Payment Collection Tracking Form', fields: [{label: 'Amount Received', key: 'amount', type: 'number', required: true}] },
          { formKey: 'expense_reimb', formName: 'Expense Reimbursement Form', fields: [{label: 'Requested Amount', key: 'amount', type: 'number', required: true}, {label: 'Receipt Proof', key: 'receipt', type: 'file', required: true}] },
          { formKey: 'op_expense', formName: 'Operational Expense Entry Form', fields: [{label: 'Vendor', key: 'vendor', type: 'text', required: true}] },
          { formKey: 'annual_budget', formName: 'Annual Budget Submission Form', fields: [{label: 'Total Department Req', key: 'total', type: 'number', required: true}] },
          { formKey: 'purchase_req', formName: 'Purchase Request Form', fields: [{label: 'Item URL', key: 'item', type: 'text', required: true}] },
          { formKey: 'payroll_prev', formName: 'Payroll Preview & Verification Form', fields: [{label: 'Verified Gross', key: 'gross', type: 'number', required: true}] }
        ]
      },
      {
        moduleKey: 'hr', name: 'HR Core',
        forms: [
          { formKey: 'leave_req', formName: 'Leave Request', fields: [{label: 'Reason', key: 'reason', type: 'text', required: true}, {label: 'Date', key: 'date', type: 'date', required: true}] },
          { formKey: 'emp_profile', formName: 'Employee Profile', fields: [{label: 'Bio', key: 'bio', type: 'textarea', required: false}] },
          { formKey: 'attendance_corr', formName: 'Attendance Correction Request', fields: [{label: 'Date', key: 'date', type: 'date', required: true}, {label: 'Actual Time', key: 'actual_time', type: 'text', required: true}] },
          { formKey: 'overtime_req', formName: 'Overtime Request', fields: [{label: 'Hours', key: 'hours', type: 'number', required: true}, {label: 'Reason', key: 'reason', type: 'text', required: true}] },
          { formKey: 'recruitment_req', formName: 'Recruitment Request', fields: [{label: 'Position Title', key: 'position', type: 'text', required: true}, {label: 'Budget', key: 'budget', type: 'number', required: false}] }
        ]
      },
      {
        moduleKey: 'crm', name: 'CRM Suite',
        forms: [
          { formKey: 'new_lead', formName: 'New Lead Intake Form', fields: [{label: 'Company Name', key: 'company', type: 'text', required: true}, {label: 'Contact Name', key: 'contact', type: 'text', required: true}] },
          { formKey: 'lead_qual', formName: 'Lead Qualification Form', fields: [{label: 'Budget Context', key: 'budget', type: 'textarea', required: true}, {label: 'Decision Maker', key: 'decision_maker', type: 'checkbox', required: true}] },
          { formKey: 'interaction', formName: 'Interaction Form', fields: [{label: 'Summary', key: 'summary', type: 'textarea', required: true}, {label: 'Outcome', key: 'outcome', type: 'text', required: true}] },
          { formKey: 'proposal_req', formName: 'Proposal Request Form', fields: [{label: 'Scope Details', key: 'scope', type: 'textarea', required: true}] },
          { formKey: 'deal_win_loss', formName: 'Deal Win/Loss Form', fields: [{label: 'Status', key: 'status', type: 'dropdown', options: ['Won', 'Lost'], required: true}, {label: 'Reason', key: 'reason', type: 'textarea', required: true}] },
          { formKey: 'client_onboard', formName: 'Client Onboarding Checklist Form', fields: [{label: 'KYC Document Sent', key: 'kyc_sent', type: 'checkbox', required: true}] }
        ]
      },
      {
        moduleKey: 'projects', name: 'Projects & Tasks',
        forms: [
          { formKey: 'proj_brief', formName: 'Project Brief Form', fields: [{label: 'Project Title', key: 'title', type: 'text', required: true}, {label: 'Scope Details', key: 'scope', type: 'textarea', required: true}] },
          { formKey: 'proj_kickoff', formName: 'Project Kick-off Form', fields: [{label: 'Kick-off Date', key: 'date', type: 'date', required: true}] },
          { formKey: 'milestone_setup', formName: 'Milestone Setup Form', fields: [{label: 'Milestone Name', key: 'name', type: 'text', required: true}] },
          { formKey: 'task_assign', formName: 'Task Assignment Form', fields: [{label: 'Task Details', key: 'details', type: 'textarea', required: true}] },
          { formKey: 'deliverable_approval', formName: 'Internal Deliverable Approval Form', fields: [{label: 'Link to Deliverable', key: 'link', type: 'text', required: true}] },
          { formKey: 'issue_report', formName: 'Issue / Bug Report Form', fields: [{label: 'Bug Description', key: 'bug', type: 'textarea', required: true}, {label: 'Severity', key: 'severity', type: 'dropdown', options: ['Low','Medium','High'], required: true}] },
          { formKey: 'change_req', formName: 'Change Request Form', fields: [{label: 'Requested Changes', key: 'changes', type: 'textarea', required: true}] },
          { formKey: 'proj_closure', formName: 'Final Project Closure Form', fields: [{label: 'Completion Notes', key: 'notes', type: 'textarea', required: true}] }
        ]
      },
      {
        moduleKey: 'brain', name: 'Brain (Knowledge Base)',
        forms: [
          { formKey: 'kb_article', formName: 'New Knowledge Article Submission Form', fields: [{label: 'Title', key: 'title', type: 'text', required: true}, {label: 'Category', key: 'category', type: 'dropdown', required: false}, {label: 'Content', key: 'content', type: 'textarea', required: true}] },
          { formKey: 'sop', formName: 'SOP Creation Form', fields: [{label: 'SOP Title', key: 'title', type: 'text', required: true}, {label: 'Procedure Content', key: 'content', type: 'textarea', required: true}] },
          { formKey: 'kb_revision', formName: 'Knowledge Revision Request Form', fields: [{label: 'Article Reference', key: 'article_ref', type: 'text', required: true}, {label: 'Change Description', key: 'change_desc', type: 'textarea', required: true}] },
          { formKey: 'kb_publish', formName: 'Internal Publication Approval Form', fields: [{label: 'Article Title', key: 'article_title', type: 'text', required: true}, {label: 'Review Notes', key: 'notes', type: 'textarea', required: false}] },
          { formKey: 'training_submit', formName: 'Training Material Submission Form', fields: [{label: 'Material Title', key: 'title', type: 'text', required: true}, {label: 'Type', key: 'type', type: 'dropdown', options: ['Document','Video','Presentation','Link'], required: true}] },
          { formKey: 'kb_feedback', formName: 'Knowledge Feedback Form', fields: [{label: 'Feedback', key: 'feedback', type: 'textarea', required: true}, {label: 'Rating', key: 'rating', type: 'number', required: false}] }
        ]
      },
      {
        moduleKey: 'okr', name: 'OKRs (Objectives & Key Results)',
        forms: [
          { formKey: 'company_annual_okr', formName: 'Company Annual OKR Submission Form', fields: [{label: 'Objective Title', key: 'title', type: 'text', required: true}] },
          { formKey: 'dept_quarterly_okr', formName: 'Department Quarterly OKR Submission Form', fields: [{label: 'Department Objective', key: 'title', type: 'text', required: true}] },
          { formKey: 'personal_okr', formName: 'Personal OKR Creation Form', fields: [{label: 'Objective', key: 'objective', type: 'text', required: true}] },
          { formKey: 'monthly_okr_progress', formName: 'Monthly OKR Progress Update Form', fields: [{label: 'Progress %', key: 'progress', type: 'number', required: true}, {label: 'Comments', key: 'comments', type: 'textarea', required: false}] },
          { formKey: 'manager_okr_eval', formName: 'Manager OKR Evaluation Form', fields: [{label: 'Score', key: 'score', type: 'number', required: true}] },
          { formKey: 'annual_performance', formName: 'Annual Performance Summary Form', fields: [{label: 'Summary', key: 'summary', type: 'textarea', required: true}] }
        ]
      }
    ];

    for (const t of defaultTemplates) {
      const [tpl] = await db.ModuleTemplate.findOrCreate({
        where: { moduleKey: t.moduleKey },
        defaults: { name: t.name, description: `Default ${t.name} template configurations` }
      });
      
      for (const f of t.forms) {
        await db.ModuleTemplateForm.findOrCreate({
          where: { moduleTemplateId: tpl.id, formKey: f.formKey },
          defaults: { formName: f.formName, defaultFields: f.fields }
        });
      }
    }
  }
}
