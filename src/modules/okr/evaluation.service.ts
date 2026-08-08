import { db } from '../../models';
import { Op, Transaction } from 'sequelize';

export class EvaluationService {

  // --- Template CRUD & Build Actions (Transacted) ---
  async createTemplate(businessId: string, createdById: string, data: any) {
    return db.sequelize.transaction(async (t) => {
      const template = await db.EvaluationTemplate.create({
        businessId,
        title: data.title,
        description: data.description,
        category: data.category,
        targetAudience: data.targetAudience,
        frequency: data.frequency,
        status: 'DRAFT',
        createdById
      }, { transaction: t });

      if (data.sections && Array.isArray(data.sections)) {
        for (let sIdx = 0; sIdx < data.sections.length; sIdx++) {
          const sec = data.sections[sIdx];
          const section = await db.EvaluationSection.create({
            businessId,
            templateId: template.id,
            title: sec.title,
            description: sec.description,
            orderIndex: sec.orderIndex !== undefined ? sec.orderIndex : sIdx
          }, { transaction: t });

          if (sec.questions && Array.isArray(sec.questions)) {
            for (let qIdx = 0; qIdx < sec.questions.length; qIdx++) {
              const q = sec.questions[qIdx];
              await db.EvaluationQuestion.create({
                businessId,
                sectionId: section.id,
                type: q.type,
                label: q.label,
                description: q.description,
                isRequired: q.isRequired || false,
                options: q.options || {},
                validationRules: q.validationRules || {},
                scoreWeight: q.scoreWeight !== undefined ? q.scoreWeight : 1.0,
                orderIndex: q.orderIndex !== undefined ? q.orderIndex : qIdx
              }, { transaction: t });
            }
          }
        }
      }

      return template;
    });
  }

  async getTemplate(businessId: string, id: string) {
    const template = await db.EvaluationTemplate.findOne({
      where: { id, businessId },
      include: [
        {
          model: db.EvaluationSection,
          as: 'sections',
          include: [{ model: db.EvaluationQuestion, as: 'questions' }]
        }
      ],
      order: [
        [{ model: db.EvaluationSection, as: 'sections' }, 'orderIndex', 'ASC'],
        [{ model: db.EvaluationSection, as: 'sections' }, { model: db.EvaluationQuestion, as: 'questions' }, 'orderIndex', 'ASC']
      ]
    });
    if (!template) throw new Error("Evaluation template not found");
    return template;
  }

  async updateTemplate(businessId: string, id: string, data: any) {
    return db.sequelize.transaction(async (t) => {
      const template = await db.EvaluationTemplate.findOne({ where: { id, businessId }, transaction: t });
      if (!template) throw new Error("Template not found");

      await template.update({
        title: data.title,
        description: data.description,
        category: data.category,
        targetAudience: data.targetAudience,
        frequency: data.frequency,
        status: data.status || template.status
      }, { transaction: t });

      // If sections are provided, we rebuild sections and questions (simplest way to update)
      if (data.sections && Array.isArray(data.sections)) {
        // Clear existing sections & questions
        const oldSections = await db.EvaluationSection.findAll({ where: { templateId: id }, transaction: t });
        const oldSecIds = oldSections.map(s => s.id);
        await db.EvaluationQuestion.destroy({ where: { sectionId: { [Op.in]: oldSecIds } }, transaction: t });
        await db.EvaluationSection.destroy({ where: { templateId: id }, transaction: t });

        // Add new
        for (let sIdx = 0; sIdx < data.sections.length; sIdx++) {
          const sec = data.sections[sIdx];
          const section = await db.EvaluationSection.create({
            businessId,
            templateId: id,
            title: sec.title,
            description: sec.description,
            orderIndex: sec.orderIndex !== undefined ? sec.orderIndex : sIdx
          }, { transaction: t });

          if (sec.questions && Array.isArray(sec.questions)) {
            for (let qIdx = 0; qIdx < sec.questions.length; qIdx++) {
              const q = sec.questions[qIdx];
              await db.EvaluationQuestion.create({
                businessId,
                sectionId: section.id,
                type: q.type,
                label: q.label,
                description: q.description,
                isRequired: q.isRequired || false,
                options: q.options || {},
                validationRules: q.validationRules || {},
                scoreWeight: q.scoreWeight !== undefined ? q.scoreWeight : 1.0,
                orderIndex: q.orderIndex !== undefined ? q.orderIndex : qIdx
              }, { transaction: t });
            }
          }
        }
      }

      return template;
    });
  }

  async duplicateTemplate(businessId: string, id: string, createdById: string) {
    return db.sequelize.transaction(async (t) => {
      const template = await this.getTemplate(businessId, id);

      const duplicated = await db.EvaluationTemplate.create({
        businessId,
        title: `${template.title} (Copy)`,
        description: template.description,
        category: template.category,
        targetAudience: template.targetAudience,
        frequency: template.frequency,
        status: 'DRAFT',
        createdById
      }, { transaction: t });

      for (const sec of template.sections || []) {
        const section = await db.EvaluationSection.create({
          businessId,
          templateId: duplicated.id,
          title: sec.title,
          description: sec.description,
          orderIndex: sec.orderIndex
        }, { transaction: t });

        for (const q of sec.questions || []) {
          await db.EvaluationQuestion.create({
            businessId,
            sectionId: section.id,
            type: q.type,
            label: q.label,
            description: q.description,
            isRequired: q.isRequired,
            options: q.options,
            validationRules: q.validationRules,
            scoreWeight: q.scoreWeight,
            orderIndex: q.orderIndex
          }, { transaction: t });
        }
      }

      return duplicated;
    });
  }

  async deleteTemplate(businessId: string, id: string) {
    const template = await db.EvaluationTemplate.findOne({ where: { id, businessId } });
    if (!template) throw new Error("Template not found");
    await template.destroy();
    return true;
  }

  async listTemplates(businessId: string, filters: any) {
    const where: any = { businessId };
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.title = { [Op.iLike]: `%${filters.search}%` };
    }

    const { limit = 20, offset = 0 } = filters;
    const { rows, count } = await db.EvaluationTemplate.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: db.EvaluationSection,
          as: 'sections',
          include: [{ model: db.EvaluationQuestion, as: 'questions' }]
        }
      ],
      order: [
        ['createdAt', 'DESC'],
        [{ model: db.EvaluationSection, as: 'sections' }, 'orderIndex', 'ASC'],
        [{ model: db.EvaluationSection, as: 'sections' }, { model: db.EvaluationQuestion, as: 'questions' }, 'orderIndex', 'ASC']
      ]
    });

    return { templates: rows, count };
  }

  // --- Assignments & Versioning ---
  async createAssignments(businessId: string, data: any) {
    return db.sequelize.transaction(async (t) => {
      const template = await this.getTemplate(businessId, data.templateId);
      if (template.status !== 'ACTIVE') {
        throw new Error("Only active templates can be assigned to evaluators");
      }

      // Re-query full sections structure to save immutable JSON snapshot
      const snapshotData = template.toJSON();

      const participants = data.participantUserIds || []; // employee targets
      const evaluators = data.evaluatorUserIds || []; // manager/peer reviewers
      const evaluatorType = data.evaluatorType || 'SELF'; // SELF, MANAGER, PEER, etc.
      const dueDate = data.dueDate;

      const createdAssignments: any[] = [];

      for (const participantId of participants) {
        for (const evaluatorId of evaluators) {
          const assignment = await db.EvaluationAssignment.create({
            businessId,
            templateId: template.id,
            targetType: data.targetType || 'EMPLOYEE',
            targetId: data.targetId || null,
            evaluatorType,
            evaluatorUserId: evaluatorId,
            participantUserId: participantId,
            dueDate,
            status: 'PENDING',
            templateSnapshot: snapshotData
          }, { transaction: t });

          createdAssignments.push(assignment);
        }
      }

      return createdAssignments;
    });
  }

  async listAssignments(businessId: string, userId: string, filters: any) {
    const where: any = { businessId };
    if (filters.role === 'evaluator') {
      where.evaluatorUserId = userId;
    } else if (filters.role === 'participant') {
      where.participantUserId = userId;
    }
    if (filters.status) where.status = filters.status;
    if (filters.templateId) where.templateId = filters.templateId;

    const assignments = await db.EvaluationAssignment.findAll({
      where,
      order: [['dueDate', 'ASC']],
      include: [
        { model: db.User, as: 'evaluator', attributes: ['id', 'fullName', 'email'] },
        { model: db.User, as: 'participant', attributes: ['id', 'fullName', 'email'] },
        { model: db.EvaluationTemplate, as: 'template', attributes: ['id', 'title', 'category'] },
        { model: db.EvaluationResponse, as: 'response' }
      ]
    });

    // Mark overdue status dynamically if date has passed and not submitted
    const nowStr = new Date().toISOString().split('T')[0];
    for (const a of assignments) {
      if (a.status === 'PENDING' && a.dueDate < nowStr) {
        await a.update({ status: 'OVERDUE' });
      }
    }

    return assignments;
  }

  // --- Submissions & Answer reference resolution ---
  async getAssignmentDetails(businessId: string, id: string) {
    const assignment = await db.EvaluationAssignment.findOne({
      where: { id, businessId },
      include: [
        { model: db.User, as: 'evaluator', attributes: ['id', 'fullName', 'email'] },
        { model: db.User, as: 'participant', attributes: ['id', 'fullName', 'email'] }
      ]
    });
    if (!assignment) throw new Error("Assignment record not found");
    return assignment;
  }

  async submitResponse(businessId: string, submitterUserId: string, data: any) {
    return db.sequelize.transaction(async (t) => {
      const assignment = await db.EvaluationAssignment.findOne({
        where: { id: data.assignmentId, businessId },
        transaction: t
      });
      if (!assignment) throw new Error("Assignment not found");
      if (assignment.status === 'SUBMITTED' || assignment.status === 'CANCELLED') {
        throw new Error("Cannot submit responses to completed/cancelled assignments");
      }

      // Create or update response
      let response = await db.EvaluationResponse.findOne({
        where: { assignmentId: assignment.id, businessId },
        transaction: t
      });

      if (response) {
        await response.update({
          status: data.isDraft ? 'DRAFT' : 'SUBMITTED',
          submittedAt: data.isDraft ? null : new Date()
        }, { transaction: t });
        // Clear previous answers to rebuild
        await db.EvaluationAnswer.destroy({ where: { responseId: response.id }, transaction: t });
      } else {
        response = await db.EvaluationResponse.create({
          businessId,
          assignmentId: assignment.id,
          templateId: assignment.templateId,
          submitterUserId,
          status: data.isDraft ? 'DRAFT' : 'SUBMITTED',
          submittedAt: data.isDraft ? null : new Date()
        }, { transaction: t });
      }

      const snapshot = assignment.templateSnapshot;
      const questionsList: any[] = [];
      (snapshot.sections || []).forEach((sec: any) => {
        (sec.questions || []).forEach((q: any) => {
          questionsList.push(q);
        });
      });

      let scoreSum = 0;
      let totalWeight = 0;

      const answers = data.answers || []; // array of { questionId, textValue, numberValue, dateValue, optionValues, referencedKpiId, referencedObjectiveId, referencedKeyResultId }

      for (const ans of answers) {
        const qDef = questionsList.find(q => q.id === ans.questionId);
        if (!qDef) continue;

        let capturedVal: number | null = null;
        if (qDef.type === 'KPI_REFERENCE' && ans.referencedKpiId) {
          const kpi = await db.Kpi.findOne({ where: { id: ans.referencedKpiId, businessId }, transaction: t });
          if (kpi) capturedVal = kpi.currentValue;
        } else if (qDef.type === 'OKR_REFERENCE' && ans.referencedKeyResultId) {
          const kr = await db.OkrKeyResult.findOne({ where: { id: ans.referencedKeyResultId, businessId }, transaction: t });
          if (kr) capturedVal = kr.currentValue;
        }

        const answerRecord = await db.EvaluationAnswer.create({
          businessId,
          responseId: response.id,
          questionId: ans.questionId,
          textValue: ans.textValue || null,
          numberValue: ans.numberValue !== undefined ? ans.numberValue : null,
          dateValue: ans.dateValue || null,
          optionValues: ans.optionValues || null,
          referencedKpiId: ans.referencedKpiId || null,
          referencedObjectiveId: ans.referencedObjectiveId || null,
          referencedKeyResultId: ans.referencedKeyResultId || null,
          capturedValue: capturedVal
        }, { transaction: t });

        // Calculate scoring rules
        let qScore: number | null = null;
        if (qDef.type === 'RATING') {
          qScore = ans.numberValue || 0;
        } else if (qDef.type === 'BOOLEAN') {
          qScore = ans.numberValue === 1 ? 100 : 0;
        } else if (qDef.type === 'SINGLE_SELECT' && ans.textValue) {
          const optsList = qDef.options?.choices || []; // choices array: [{ value: 'EXCELLENT', score: 100 }]
          const matchedChoice = optsList.find((c: any) => c.value === ans.textValue);
          if (matchedChoice && matchedChoice.score !== undefined) {
            qScore = parseFloat(matchedChoice.score);
          }
        }

        if (qScore !== null) {
          scoreSum += (qScore * (qDef.scoreWeight || 1.0));
          totalWeight += (qDef.scoreWeight || 1.0);
        }
      }

      if (!data.isDraft) {
        const finalScore = totalWeight > 0 ? scoreSum / totalWeight : null;
        await response.update({ score: finalScore }, { transaction: t });
        await assignment.update({ status: 'SUBMITTED', completedAt: new Date() }, { transaction: t });
      } else {
        await assignment.update({ status: 'IN_PROGRESS' }, { transaction: t });
      }

      return response;
    });
  }

  async getResponseDetails(businessId: string, assignmentId: string) {
    const response = await db.EvaluationResponse.findOne({
      where: { assignmentId, businessId },
      include: [
        { model: db.EvaluationAnswer, as: 'answers' }
      ]
    });
    return response;
  }

  async getCompletionStats(businessId: string, templateId: string) {
    const assignments = await db.EvaluationAssignment.findAll({
      where: { templateId, businessId }
    });

    const total = assignments.length;
    const submitted = assignments.filter(a => a.status === 'SUBMITTED').length;
    const pending = assignments.filter(a => a.status === 'PENDING').length;
    const inProgress = assignments.filter(a => a.status === 'IN_PROGRESS').length;
    const overdue = assignments.filter(a => a.status === 'OVERDUE').length;

    return {
      totalCount: total,
      submittedCount: submitted,
      pendingCount: pending,
      inProgressCount: inProgress,
      overdueCount: overdue,
      completionRate: total > 0 ? Math.round((submitted / total) * 100) : 0
    };
  }
}

export const evaluationService = new EvaluationService();
