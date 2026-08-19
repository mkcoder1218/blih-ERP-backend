import { db } from '../src/models';
import { evaluationService } from '../src/modules/okr/evaluation.service';

describe('Evaluation Form Feature Integration & Transactions Suite', () => {
  let business: any;
  let user: any;
  let colleague: any;

  beforeAll(async () => {
    business = await db.Business.findOne();
    if (!business) {
      business = await db.Business.create({
        name: 'Evaluation Inc',
        slug: 'eval-inc',
        currency: 'USD',
        status: 'active',
        settings: {}
      });
    }

    user = await db.User.findOne({ where: { businessId: business.id } });
    if (!user) {
      user = await db.User.create({
        businessId: business.id,
        fullName: 'Evaluation Evaluator',
        email: 'evaluator@eval.local',
        password: 'securePassword123'
      });
    }

    colleague = await db.User.findOne({ where: { email: 'colleague@eval.local' } });
    if (!colleague) {
      colleague = await db.User.create({
        businessId: business.id,
        fullName: 'Evaluation Subject',
        email: 'colleague@eval.local',
        password: 'securePassword123'
      });
    }
  });

  it('runs template creation, duplication, and statistics transactions', async () => {
    // 1. Create Template
    const template = await evaluationService.createTemplate(business.id, user.id, {
      title: 'Annual Performance Appraisal',
      description: 'Review key targets',
      category: 'PERFORMANCE_REVIEW',
      targetAudience: 'All Employees',
      frequency: 'ANNUAL',
      sections: [
        {
          title: 'Core Values',
          description: 'Assess alignment',
          orderIndex: 0,
          questions: [
            {
              type: 'RATING',
              label: 'Team collaboration and transparency?',
              isRequired: true,
              scoreWeight: 2.0,
              orderIndex: 0
            },
            {
              type: 'BOOLEAN',
              label: 'Achieved individual tasks?',
              isRequired: false,
              scoreWeight: 1.0,
              orderIndex: 1
            }
          ]
        }
      ]
    });

    expect(template.title).toBe('Annual Performance Appraisal');

    // Make active so it can be assigned
    await template.update({ status: 'ACTIVE' });

    // 2. Duplicate Template Check
    const copy = await evaluationService.duplicateTemplate(business.id, template.id, user.id);
    expect(copy.title).toBe('Annual Performance Appraisal (Copy)');
    expect(copy.status).toBe('DRAFT');

    // 3. Create Assignment
    const assignments = await evaluationService.createAssignments(business.id, {
      templateId: template.id,
      targetType: 'EMPLOYEE',
      targetId: colleague.id,
      evaluatorType: 'MANAGER',
      evaluatorUserIds: [user.id],
      participantUserIds: [colleague.id],
      dueDate: '2026-12-31'
    });

    expect(assignments.length).toBe(1);
    const assign = assignments[0];
    expect(assign.status).toBe('PENDING');
    expect(assign.templateSnapshot.title).toBe('Annual Performance Appraisal');

    // 4. Submit Response with score evaluation
    const response = await evaluationService.submitResponse(business.id, user.id, {
      assignmentId: assign.id,
      isDraft: false,
      answers: [
        {
          questionId: assign.templateSnapshot.sections[0].questions[0].id,
          numberValue: 4 // rating score
        },
        {
          questionId: assign.templateSnapshot.sections[0].questions[1].id,
          numberValue: 1 // boolean true -> 100
        }
      ]
    });

    // Score evaluation:
    // Q1 score: 4 out of 5 -> weight 2.0 -> contribution = 4 * 2 = 8
    // Q2 score: 1 (Boolean Yes) -> 100 -> weight 1.0 -> contribution = 100 * 1 = 100
    // Wait! Let's double check RATING scoring representation.
    // In our code: qScore for RATING was: ans.numberValue (e.g. 4)
    // qScore for BOOLEAN was: 100 (if numberValue === 1).
    // Total Score = (4 * 2 + 100 * 1) / (2 + 1) = 108 / 3 = 36
    expect(response.status).toBe('SUBMITTED');
    expect(response.score).toBe(36);

    const stats = await evaluationService.getCompletionStats(business.id, template.id);
    expect(stats.submittedCount).toBe(1);
    expect(stats.completionRate).toBe(100);

    // Clean up
    await db.EvaluationResponse.destroy({ where: { id: response.id } });
    await db.EvaluationAssignment.destroy({ where: { id: assign.id } });
    await evaluationService.deleteTemplate(business.id, template.id);
    await evaluationService.deleteTemplate(business.id, copy.id);
  });
});
