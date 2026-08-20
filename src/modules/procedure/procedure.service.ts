import { Op } from 'sequelize';
import { db } from '../../models';
import { sanitizeArticleContent } from '../brain/brain.sanitizer';
import { InternalNotifier } from '../notification/notification.service';

export class ProcedureService {

  // ── Helper: User Department Resolution ──
  async getUserDepartmentId(userId: string, businessId: string): Promise<string | null> {
    try {
      const emp = await db.EmployeeRecord.findOne({
        where: { userId, businessId },
        attributes: ['departmentId']
      });
      if (emp?.departmentId) return emp.departmentId;
      const usr = await db.User.findOne({
        where: { id: userId, businessId },
        attributes: ['departmentId']
      });
      return usr?.departmentId || null;
    } catch {
      return null;
    }
  }

  // ── Helper: Visibility & Access Check ──
  canUserAccessProcedure(user: any, procedure: any, userDeptId: string | null): boolean {
    if (user.isPlatformSuperAdmin) return true;
    if (procedure.businessId !== user.businessId) return false;

    const perms = new Set<string>(user.permissions || []);
    const isAuthor = procedure.authorUserId === user.id;
    const hasElevated = perms.has('procedures.procedure.update_any') ||
                        perms.has('procedures.procedure.review') ||
                        perms.has('procedures.procedure.publish');

    // Workflow status check: non-published documents are restricted to author & elevated users
    if (procedure.status !== 'published' && !isAuthor && !hasElevated) {
      return false;
    }

    // ACL Visibility check
    const vis = procedure.visibility || 'company';
    if (vis === 'company') {
      return perms.has('procedures.procedure.view') || isAuthor || hasElevated;
    }
    if (vis === 'private') {
      return isAuthor || hasElevated;
    }
    if (vis === 'department') {
      if (isAuthor || hasElevated) return true;
      return Boolean(userDeptId && procedure.responsibleDepartmentId === userDeptId);
    }

    return true;
  }

  // ── Helper: Slug Generator ──
  async generateUniqueSlug(businessId: string, title: string, currentProcedureId?: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'procedure';

    let candidate = baseSlug;
    let counter = 1;

    while (true) {
      const where: any = { businessId, slug: candidate };
      if (currentProcedureId) {
        where.id = { [Op.ne]: currentProcedureId };
      }
      const existing = await db.Procedure.findOne({ where, paranoid: false });
      if (!existing) {
        return candidate;
      }
      counter++;
      candidate = `${baseSlug}-${counter}`;
    }
  }

  // ── Create Procedure ──
  async createProcedure(businessId: string, authorUserId: string, data: any) {
    const title = data.title.trim();
    const slug = await this.generateUniqueSlug(businessId, title);

    if (data.categoryId) {
      const cat = await db.KnowledgeCategory.findOne({ where: { id: data.categoryId, businessId } });
      if (!cat) {
        const err: any = new Error('Category not found');
        err.statusCode = 404;
        throw err;
      }
    }

    // Sanitization using Brain's sanitizer
    const purposeSanitized = data.purpose ? sanitizeArticleContent(data.purpose).content : null;
    const scopeSanitized = data.scope ? sanitizeArticleContent(data.scope).content : null;
    const responsibilitiesSanitized = data.responsibilities ? sanitizeArticleContent(data.responsibilities).content : null;
    const prerequisitesSanitized = data.prerequisites ? sanitizeArticleContent(data.prerequisites).content : null;
    const expectedResultSanitized = data.expectedResult ? sanitizeArticleContent(data.expectedResult).content : null;

    const stepsSanitized = (data.steps || []).map((step: any) => ({
      instruction: step.instruction ? sanitizeArticleContent(step.instruction).content : '',
      expectedResult: step.expectedResult ? sanitizeArticleContent(step.expectedResult).content : null
    }));

    const procedure = await db.Procedure.create({
      ...data,
      title,
      slug,
      businessId,
      authorUserId,
      purpose: purposeSanitized,
      scope: scopeSanitized,
      responsibilities: responsibilitiesSanitized,
      prerequisites: prerequisitesSanitized,
      expectedResult: expectedResultSanitized,
      steps: stepsSanitized,
      status: 'draft',
      version: 1
    });

    // Create initial revision
    await db.ProcedureRevision.create({
      businessId,
      procedureId: procedure.id,
      revisedByUserId: authorUserId,
      version: 1,
      changeSummary: 'Initial creation',
      contentSnapshot: procedure.toJSON()
    });

    return procedure;
  }

  // ── Update Procedure ──
  async updateProcedure(businessId: string, id: string, user: any, data: any, changeSummary?: string) {
    return db.sequelize.transaction(async (transaction: any) => {
      const procedure = await db.Procedure.findOne({
        where: { id, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!procedure) {
        const err: any = new Error('Procedure not found');
        err.statusCode = 404;
        throw err;
      }

      const perms = new Set<string>(user.permissions || []);
      const isAuthor = procedure.authorUserId === user.id;

      if (!isAuthor && !perms.has('procedures.procedure.update_any')) {
        const err: any = new Error('Forbidden (permission)');
        err.statusCode = 403;
        throw err;
      }

      // Workflow locking: if in_review, changes are locked except for managers with update_any
      if (procedure.status === 'in_review' && !perms.has('procedures.procedure.update_any')) {
        const err: any = new Error('Procedure is currently in review and locked');
        err.statusCode = 400;
        throw err;
      }

      const updates: any = {};
      if (data.title) {
        updates.title = data.title.trim();
        updates.slug = await this.generateUniqueSlug(businessId, updates.title, id);
      }
      if (data.categoryId !== undefined) updates.categoryId = data.categoryId;
      if (data.responsibleDepartmentId !== undefined) updates.responsibleDepartmentId = data.responsibleDepartmentId;
      if (data.visibility !== undefined) updates.visibility = data.visibility;
      if (data.effectiveDate !== undefined) updates.effectiveDate = data.effectiveDate;
      if (data.reviewDueDate !== undefined) updates.reviewDueDate = data.reviewDueDate;
      if (data.metadata !== undefined) updates.metadata = data.metadata;
      
      if (data.steps !== undefined) {
        updates.steps = (data.steps || []).map((step: any) => ({
          instruction: step.instruction ? sanitizeArticleContent(step.instruction).content : '',
          expectedResult: step.expectedResult ? sanitizeArticleContent(step.expectedResult).content : null
        }));
      }

      // Sanitization
      if (data.purpose !== undefined) updates.purpose = data.purpose ? sanitizeArticleContent(data.purpose).content : null;
      if (data.scope !== undefined) updates.scope = data.scope ? sanitizeArticleContent(data.scope).content : null;
      if (data.responsibilities !== undefined) updates.responsibilities = data.responsibilities ? sanitizeArticleContent(data.responsibilities).content : null;
      if (data.prerequisites !== undefined) updates.prerequisites = data.prerequisites ? sanitizeArticleContent(data.prerequisites).content : null;
      if (data.expectedResult !== undefined) updates.expectedResult = data.expectedResult ? sanitizeArticleContent(data.expectedResult).content : null;

      const newVersion = procedure.version + 1;
      updates.version = newVersion;

      await procedure.update(updates, { transaction });

      // Create revision snapshot
      await db.ProcedureRevision.create({
        businessId,
        procedureId: procedure.id,
        revisedByUserId: user.id,
        version: newVersion,
        changeSummary: changeSummary || 'Update procedure content',
        contentSnapshot: procedure.toJSON()
      }, { transaction });

      return procedure;
    });
  }

  // ── Delete / Restore ──
  async deleteProcedure(businessId: string, id: string, user: any) {
    const procedure = await db.Procedure.findOne({ where: { id, businessId } });
    if (!procedure) {
      const err: any = new Error('Procedure not found');
      err.statusCode = 404;
      throw err;
    }
    await procedure.destroy();
    return { success: true, message: 'Procedure deleted successfully' };
  }

  async restoreProcedure(businessId: string, id: string, user: any) {
    const procedure = await db.Procedure.findOne({ where: { id, businessId }, paranoid: false });
    if (!procedure) {
      const err: any = new Error('Procedure not found');
      err.statusCode = 404;
      throw err;
    }
    await procedure.restore();
    return procedure;
  }

  // ── Workflow Actions ──
  async submitForReview(businessId: string, id: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const procedure = await db.Procedure.findOne({
        where: { id, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!procedure) {
        const err: any = new Error('Procedure not found');
        err.statusCode = 404;
        throw err;
      }

      if (!['draft', 'changes_requested'].includes(procedure.status)) {
        const err: any = new Error(`Cannot submit procedure for review from status "${procedure.status}"`);
        err.statusCode = 400;
        throw err;
      }

      const isAuthor = procedure.authorUserId === user.id;
      const perms = new Set<string>(user.permissions || []);
      if (!isAuthor && !perms.has('procedures.procedure.update_any')) {
        const err: any = new Error('Forbidden (permission)');
        err.statusCode = 403;
        throw err;
      }

      const now = new Date();
      const newVersion = procedure.version + 1;
      await procedure.update({
        status: 'in_review',
        submittedAt: now,
        submittedByUserId: user.id,
        version: newVersion
      }, { transaction });

      await db.ProcedureRevision.create({
        businessId,
        procedureId: procedure.id,
        revisedByUserId: user.id,
        version: newVersion,
        changeSummary: 'Submitted for review',
        contentSnapshot: procedure.toJSON()
      }, { transaction });

      await this.notifyReviewers(businessId, procedure.id, procedure.title);
      return procedure;
    });
  }

  async approveProcedure(businessId: string, id: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const procedure = await db.Procedure.findOne({
        where: { id, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!procedure) {
        const err: any = new Error('Procedure not found');
        err.statusCode = 404;
        throw err;
      }

      if (procedure.status !== 'in_review') {
        const err: any = new Error(`Cannot approve procedure from status "${procedure.status}"`);
        err.statusCode = 400;
        throw err;
      }

      if (procedure.submittedByUserId === user.id && !user.isPlatformSuperAdmin) {
        const err: any = new Error('You cannot approve a procedure you submitted for review');
        err.statusCode = 403;
        throw err;
      }

      const now = new Date();
      const newVersion = procedure.version + 1;
      await procedure.update({
        status: 'approved',
        reviewedAt: now,
        reviewedByUserId: user.id,
        version: newVersion
      }, { transaction });

      await db.ProcedureRevision.create({
        businessId,
        procedureId: procedure.id,
        revisedByUserId: user.id,
        version: newVersion,
        changeSummary: 'Procedure approved',
        contentSnapshot: procedure.toJSON()
      }, { transaction });

      return procedure;
    });
  }

  async requestChanges(businessId: string, id: string, user: any, comment: string) {
    return db.sequelize.transaction(async (transaction: any) => {
      const procedure = await db.Procedure.findOne({
        where: { id, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!procedure) {
        const err: any = new Error('Procedure not found');
        err.statusCode = 404;
        throw err;
      }

      if (procedure.status !== 'in_review') {
        const err: any = new Error(`Cannot request changes from status "${procedure.status}"`);
        err.statusCode = 400;
        throw err;
      }

      const now = new Date();
      const newVersion = procedure.version + 1;
      const updatedMetadata = { ...procedure.metadata, reviewComment: comment };

      await procedure.update({
        status: 'changes_requested',
        reviewedAt: now,
        reviewedByUserId: user.id,
        metadata: updatedMetadata,
        version: newVersion
      }, { transaction });

      await db.ProcedureRevision.create({
        businessId,
        procedureId: procedure.id,
        revisedByUserId: user.id,
        version: newVersion,
        changeSummary: `Changes requested: ${comment}`,
        contentSnapshot: procedure.toJSON()
      }, { transaction });

      // Notify author
      try {
        await InternalNotifier.send({
          businessId,
          recipientUserId: procedure.authorUserId,
          moduleKey: 'procedures',
          type: 'changes_requested',
          title: 'Changes Requested on Procedure',
          message: `Changes were requested on procedure "${procedure.title}": ${comment}`,
          entityType: 'procedure',
          entityId: procedure.id
        });
      } catch {}

      return procedure;
    });
  }

  async publishProcedure(businessId: string, id: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const procedure = await db.Procedure.findOne({
        where: { id, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!procedure) {
        const err: any = new Error('Procedure not found');
        err.statusCode = 404;
        throw err;
      }

      if (!['approved', 'published'].includes(procedure.status)) {
        const err: any = new Error(`Cannot publish procedure from status "${procedure.status}"`);
        err.statusCode = 400;
        throw err;
      }

      const now = new Date();
      const newVersion = procedure.version + 1;
      await procedure.update({
        status: 'published',
        publishedAt: now,
        publishedByUserId: user.id,
        effectiveDate: procedure.effectiveDate || now,
        version: newVersion
      }, { transaction });

      await db.ProcedureRevision.create({
        businessId,
        procedureId: procedure.id,
        revisedByUserId: user.id,
        version: newVersion,
        changeSummary: 'Procedure published',
        contentSnapshot: procedure.toJSON()
      }, { transaction });

      return procedure;
    });
  }

  async unpublishProcedure(businessId: string, id: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const procedure = await db.Procedure.findOne({
        where: { id, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!procedure) {
        const err: any = new Error('Procedure not found');
        err.statusCode = 404;
        throw err;
      }

      if (procedure.status !== 'published') {
        const err: any = new Error('Procedure is not published');
        err.statusCode = 400;
        throw err;
      }

      const newVersion = procedure.version + 1;
      await procedure.update({
        status: 'approved', // Return to approved state
        publishedAt: null,
        publishedByUserId: null,
        version: newVersion
      }, { transaction });

      await db.ProcedureRevision.create({
        businessId,
        procedureId: procedure.id,
        revisedByUserId: user.id,
        version: newVersion,
        changeSummary: 'Procedure unpublished',
        contentSnapshot: procedure.toJSON()
      }, { transaction });

      return procedure;
    });
  }

  async archiveProcedure(businessId: string, id: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const procedure = await db.Procedure.findOne({
        where: { id, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!procedure) {
        const err: any = new Error('Procedure not found');
        err.statusCode = 404;
        throw err;
      }

      const now = new Date();
      const newVersion = procedure.version + 1;
      await procedure.update({
        status: 'archived',
        archivedAt: now,
        archivedByUserId: user.id,
        version: newVersion
      }, { transaction });

      await db.ProcedureRevision.create({
        businessId,
        procedureId: procedure.id,
        revisedByUserId: user.id,
        version: newVersion,
        changeSummary: 'Procedure archived',
        contentSnapshot: procedure.toJSON()
      }, { transaction });

      return procedure;
    });
  }

  // ── Queries & Read Operations ──
  async getProcedure(businessId: string, id: string, user: any) {
    const procedure = await db.Procedure.findOne({
      where: { id, businessId },
      include: [
        { model: db.KnowledgeCategory, attributes: ['id', 'name', 'key'] }
      ]
    });

    if (!procedure) {
      const err: any = new Error('Procedure not found');
      err.statusCode = 404;
      throw err;
    }

    const deptId = await this.getUserDepartmentId(user.id, businessId);
    if (!this.canUserAccessProcedure(user, procedure, deptId)) {
      const err: any = new Error('Forbidden (permission)');
      err.statusCode = 403;
      throw err;
    }

    return procedure;
  }

  async listProcedures(businessId: string, user: any, query: any) {
    const page = parseInt(query.page) || 1;
    const size = parseInt(query.size) || 20;
    const offset = (page - 1) * size;

    const where: any = { businessId };

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) {
      where.status = query.status;
    } else if (!query.includeArchived) {
      where.status = { [Op.ne]: 'archived' };
    }

    if (query.visibility) where.visibility = query.visibility;
    if (query.authorUserId) where.authorUserId = query.authorUserId;
    if (query.responsibleDepartmentId) where.responsibleDepartmentId = query.responsibleDepartmentId;

    if (query.search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${query.search}%` } },
        { purpose: { [Op.iLike]: `%${query.search}%` } },
        { scope: { [Op.iLike]: `%${query.search}%` } }
      ];
    }

    const userDeptId = await this.getUserDepartmentId(user.id, businessId);
    const perms = new Set<string>(user.permissions || []);
    const hasElevated = perms.has('procedures.procedure.update_any') ||
                        perms.has('procedures.procedure.review') ||
                        perms.has('procedures.procedure.publish') ||
                        user.isPlatformSuperAdmin;

    // Apply visibility scoping for list view (unless super admin or manager with elevated access)
    if (!hasElevated) {
      const accessClause: Record<string, unknown>[] = [
        { visibility: 'company', status: 'published' },
        { authorUserId: user.id }
      ];

      if (userDeptId) {
        accessClause.push({ visibility: 'department', responsibleDepartmentId: userDeptId, status: 'published' });
      }

      where[Op.and] = [
        ...(where[Op.and] || []),
        { [Op.or]: accessClause }
      ];
    }

    const sortBy = query.sortBy || 'updatedAt';
    const sortDirection = (query.sortDirection || 'DESC').toUpperCase();

    const { count, rows } = await db.Procedure.findAndCountAll({
      where,
      limit: size,
      offset,
      order: [[sortBy, sortDirection]],
      include: [
        { model: db.KnowledgeCategory, attributes: ['id', 'name', 'key'] }
      ]
    });

    return {
      procedures: rows,
      total: count,
      page,
      size,
      totalPages: Math.ceil(count / size)
    };
  }

  // ── Revisions ──
  async listRevisions(businessId: string, procedureId: string, user: any, page: number, size: number) {
    const procedure = await this.getProcedure(businessId, procedureId, user); // checks access permissions
    const offset = (page - 1) * size;

    const { count, rows } = await db.ProcedureRevision.findAndCountAll({
      where: { businessId, procedureId },
      limit: size,
      offset,
      order: [['version', 'DESC']],
      include: [
        { model: db.User, as: 'revisedBy', attributes: ['id', 'firstName', 'lastName', 'email'] }
      ]
    });

    return {
      revisions: rows,
      total: count,
      page,
      size,
      totalPages: Math.ceil(count / size)
    };
  }

  async getRevision(businessId: string, procedureId: string, revisionId: string, user: any) {
    await this.getProcedure(businessId, procedureId, user); // checks access permissions

    const revision = await db.ProcedureRevision.findOne({
      where: { id: revisionId, businessId, procedureId },
      include: [
        { model: db.User, as: 'revisedBy', attributes: ['id', 'firstName', 'lastName', 'email'] }
      ]
    });

    if (!revision) {
      const err: any = new Error('Revision not found');
      err.statusCode = 404;
      throw err;
    }

    return revision;
  }

  async restoreRevision(businessId: string, procedureId: string, revisionId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const procedure = await db.Procedure.findOne({
        where: { id: procedureId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!procedure) {
        const err: any = new Error('Procedure not found');
        err.statusCode = 404;
        throw err;
      }

      const revision = await db.ProcedureRevision.findOne({
        where: { id: revisionId, businessId, procedureId },
        transaction
      });

      if (!revision) {
        const err: any = new Error('Revision not found');
        err.statusCode = 404;
        throw err;
      }

      const snapshot = revision.contentSnapshot;
      const updates = {
        title: snapshot.title,
        slug: snapshot.slug,
        categoryId: snapshot.categoryId,
        responsibleDepartmentId: snapshot.responsibleDepartmentId,
        purpose: snapshot.purpose,
        scope: snapshot.scope,
        responsibilities: snapshot.responsibilities,
        prerequisites: snapshot.prerequisites,
        steps: snapshot.steps,
        expectedResult: snapshot.expectedResult,
        visibility: snapshot.visibility,
        metadata: snapshot.metadata,
        version: procedure.version + 1
      };

      await procedure.update(updates, { transaction });

      await db.ProcedureRevision.create({
        businessId,
        procedureId: procedure.id,
        revisedByUserId: user.id,
        version: updates.version,
        changeSummary: `Restored to version ${revision.version}`,
        contentSnapshot: procedure.toJSON()
      }, { transaction });

      return procedure;
    });
  }

  // ── Notifications Helper ──
  private async notifyReviewers(businessId: string, procedureId: string, title: string) {
    try {
      // Find Business Administrators and Knowledge Managers
      const managers = await db.UserRole.findAll({
        include: [{ model: db.Role, where: { key: ['KNOWLEDGE_MANAGER', 'BUSINESS_ADMIN'], businessId: [businessId, null] } }]
      });
      for (const m of managers) {
        await InternalNotifier.send({
          businessId,
          recipientUserId: m.userId,
          moduleKey: 'procedures',
          type: 'publication_request',
          title: 'Procedure Publication Review Request',
          message: `Procedure "${title}" has been submitted for review.`,
          entityType: 'procedure',
          entityId: procedureId
        });
      }
    } catch {}
  }
}
