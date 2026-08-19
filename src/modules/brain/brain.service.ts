import { db } from '../../models';
import { InternalNotifier } from '../notification/notification.service';
import { Op } from 'sequelize';
import { sanitizeArticleContent } from './brain.sanitizer';

export class BrainService {

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

  // ── Helper: Article Visibility & Access Check ──
  canUserAccessArticle(user: any, article: any, userDeptId: string | null): boolean {
    if (user.isPlatformSuperAdmin) return true;
    if (article.businessId !== user.businessId) return false;

    const perms = new Set<string>(user.permissions || []);
    const isAuthor = article.authorUserId === user.id;
    const hasElevated = perms.has('brain.article.update_any') ||
                        perms.has('brain.article.review') ||
                        perms.has('brain.article.publish');

    // Workflow status check: non-published documents are restricted to author & elevated users
    if (article.status !== 'published' && !isAuthor && !hasElevated) {
      return false;
    }

    // ACL Visibility check
    const vis = article.visibility || 'company';
    if (vis === 'company') {
      return perms.has('brain.article.view') || isAuthor || hasElevated;
    }
    if (vis === 'private') {
      return isAuthor || hasElevated;
    }
    if (vis === 'department') {
      if (isAuthor || hasElevated) return true;
      const deptIds = article.metadata?.departmentIds || [];
      return Boolean(userDeptId && deptIds.includes(userDeptId));
    }

    return true;
  }

  // ── Helper: Slug Generator ──
  async generateUniqueSlug(businessId: string, title: string, currentArticleId?: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'article';

    let candidate = baseSlug;
    let counter = 1;

    while (true) {
      const where: any = { businessId, slug: candidate };
      if (currentArticleId) {
        where.id = { [Op.ne]: currentArticleId };
      }
      const existing = await db.KnowledgeArticle.findOne({ where, paranoid: false });
      if (!existing) {
        return candidate;
      }
      counter++;
      candidate = `${baseSlug}-${counter}`;
    }
  }

  // ── Helper: Category Ancestry Check ──
  async checkCircularAncestry(businessId: string, categoryId: string, newParentId: string): Promise<boolean> {
    if (categoryId === newParentId) return true;

    let currentId: string | null = newParentId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === categoryId) return true;
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const parent = await db.KnowledgeCategory.findOne({
        where: { id: currentId, businessId },
        attributes: ['parentCategoryId']
      });
      currentId = parent?.parentCategoryId || null;
    }

    return false;
  }

  // ── Categories ──

  async createCategory(businessId: string, data: any) {
    const name = data.name.trim();
    let key = data.key ? data.key.trim().toLowerCase() : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check duplicate key in business
    const existing = await db.KnowledgeCategory.findOne({
      where: { businessId, key }
    });
    if (existing) {
      const err: any = new Error('Category key already exists in this business');
      err.statusCode = 409;
      throw err;
    }

    // Validate parent category
    if (data.parentCategoryId) {
      const parent = await db.KnowledgeCategory.findOne({
        where: { id: data.parentCategoryId, businessId }
      });
      if (!parent) {
        const err: any = new Error('Parent category not found');
        err.statusCode = 404;
        throw err;
      }
      if (parent.status === 'archived') {
        const err: any = new Error('Cannot assign an archived category as parent for a new active category');
        err.statusCode = 400;
        throw err;
      }
    }

    return db.KnowledgeCategory.create({
      ...data,
      name,
      key,
      businessId,
      visibility: data.visibility || 'company',
      status: data.status || 'active'
    });
  }

  async updateCategory(businessId: string, id: string, data: any) {
    const category = await db.KnowledgeCategory.findOne({ where: { id, businessId } });
    if (!category) {
      const err: any = new Error('Category not found');
      err.statusCode = 404;
      throw err;
    }

    if (data.key && data.key !== category.key) {
      const existing = await db.KnowledgeCategory.findOne({
        where: { businessId, key: data.key, id: { [Op.ne]: id } }
      });
      if (existing) {
        const err: any = new Error('Category key already exists in this business');
        err.statusCode = 409;
        throw err;
      }
    }

    if (data.parentCategoryId !== undefined && data.parentCategoryId !== category.parentCategoryId) {
      if (data.parentCategoryId) {
        if (data.parentCategoryId === id) {
          const err: any = new Error('Category cannot be its own parent');
          err.statusCode = 400;
          throw err;
        }
        const isCircular = await this.checkCircularAncestry(businessId, id, data.parentCategoryId);
        if (isCircular) {
          const err: any = new Error('Circular parent category relationship detected');
          err.statusCode = 400;
          throw err;
        }
        const parent = await db.KnowledgeCategory.findOne({
          where: { id: data.parentCategoryId, businessId }
        });
        if (!parent) {
          const err: any = new Error('Parent category not found');
          err.statusCode = 404;
          throw err;
        }
        if (parent.status === 'archived' && (data.status || category.status) === 'active') {
          const err: any = new Error('Cannot assign an archived category as parent');
          err.statusCode = 400;
          throw err;
        }
      }
    }

    await category.update(data);
    return category;
  }

  async deleteCategory(businessId: string, id: string) {
    const category = await db.KnowledgeCategory.findOne({ where: { id, businessId } });
    if (!category) {
      const err: any = new Error('Category not found');
      err.statusCode = 404;
      throw err;
    }

    // Check active subcategories
    const childCount = await db.KnowledgeCategory.count({
      where: { parentCategoryId: id, businessId }
    });
    if (childCount > 0) {
      const err: any = new Error('Cannot delete category with active subcategories');
      err.statusCode = 409;
      throw err;
    }

    // Check non-deleted articles
    const articleCount = await db.KnowledgeArticle.count({
      where: { categoryId: id, businessId }
    });
    if (articleCount > 0) {
      const err: any = new Error('Cannot delete category containing articles');
      err.statusCode = 409;
      throw err;
    }

    await category.destroy();
    return { success: true, message: 'Category deleted successfully' };
  }

  async restoreCategory(businessId: string, id: string) {
    const category = await db.KnowledgeCategory.findOne({
      where: { id, businessId },
      paranoid: false
    });
    if (!category || !category.deletedAt) {
      const err: any = new Error('Soft-deleted category not found');
      err.statusCode = 404;
      throw err;
    }

    // Check key conflict among non-deleted categories
    const existing = await db.KnowledgeCategory.findOne({
      where: { businessId, key: category.key }
    });
    if (existing) {
      const err: any = new Error('Category key already exists in this business');
      err.statusCode = 409;
      throw err;
    }

    // Deterministic parent handling: if parent category is deleted or missing, detach parent
    if (category.parentCategoryId) {
      const parent = await db.KnowledgeCategory.findOne({
        where: { id: category.parentCategoryId, businessId }
      });
      if (!parent || parent.status === 'archived') {
        await category.update({ parentCategoryId: null });
      }
    }

    await category.restore();
    return category;
  }

  async getCategory(businessId: string, id: string) {
    const category = await db.KnowledgeCategory.findOne({
      where: { id, businessId },
      include: [
        { model: db.KnowledgeCategory, as: 'parentCategory' },
        { model: db.KnowledgeCategory, as: 'subcategories' }
      ]
    });
    if (!category) {
      const err: any = new Error('Category not found');
      err.statusCode = 404;
      throw err;
    }
    return category;
  }

  async listCategories(businessId: string, query: any, userPermissions: string[]) {
    const q = query || {};
    const page = Math.max(1, parseInt(q.page) || 1);
    const size = Math.min(100, Math.max(1, parseInt(q.size) || 20));
    const offset = (page - 1) * size;

    const where: any = { businessId };

    if (q.status) {
      where.status = q.status;
    }

    if (q.visibility) {
      where.visibility = q.visibility;
    }

    if (q.parentCategoryId !== undefined) {
      where.parentCategoryId = q.parentCategoryId === '' ? null : q.parentCategoryId;
    }

    if (q.search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q.search}%` } },
        { key: { [Op.iLike]: `%${q.search}%` } },
        { description: { [Op.iLike]: `%${q.search}%` } }
      ];
    }

    let paranoid = true;
    if (q.includeArchived === 'true' || q.includeArchived === true) {
      if (userPermissions.includes('brain.category.delete')) {
        paranoid = false;
      }
    }

    const { rows, count } = await db.KnowledgeCategory.findAndCountAll({
      where,
      paranoid,
      offset,
      limit: size,
      include: [{ model: db.KnowledgeCategory, as: 'subcategories' }],
      order: [['name', 'ASC'], ['id', 'ASC']]
    });

    return {
      rows,
      count,
      page,
      size,
      pages: Math.ceil(count / size)
    };
  }

  // ── Articles ──

  async createArticle(businessId: string, authorUserId: string, data: any) {
    if (data.categoryId) {
      const cat = await db.KnowledgeCategory.findOne({
        where: { id: data.categoryId, businessId }
      });
      if (!cat || cat.status === 'archived') {
        const err: any = new Error('Invalid or archived category');
        err.statusCode = 400;
        throw err;
      }
    }

    const slug = await this.generateUniqueSlug(businessId, data.title);
    const { content, contentText } = sanitizeArticleContent(data.content);

    return db.sequelize.transaction(async (transaction: any) => {
      const article = await db.KnowledgeArticle.create({
        title: data.title.trim(),
        summary: data.summary || null,
        content,
        contentText,
        categoryId: data.categoryId || null,
        visibility: data.visibility || 'company',
        metadata: data.metadata || {},
        businessId,
        authorUserId,
        slug,
        status: 'draft',
        version: 1
      }, { transaction });

      await db.KnowledgeRevision.create({
        businessId,
        articleId: article.id,
        revisedByUserId: authorUserId,
        version: 1,
        changeSummary: 'Initial creation',
        contentSnapshot: {
          action: 'CREATE',
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          content: article.content,
          contentText: article.contentText,
          categoryId: article.categoryId,
          visibility: article.visibility,
          status: article.status,
          metadata: article.metadata,
          version: 1,
          actorUserId: authorUserId
        }
      }, { transaction });

      return article;
    });
  }

  async updateArticle(businessId: string, articleId: string, user: any, data: any, changeSummary?: string) {
    const userDeptId = await this.getUserDepartmentId(user.id, businessId);

    return db.sequelize.transaction(async (transaction: any) => {
      const article = await db.KnowledgeArticle.findOne({
        where: { id: articleId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!article) {
        const err: any = new Error('Article not found');
        err.statusCode = 404;
        throw err;
      }

      if (!this.canUserAccessArticle(user, article, userDeptId)) {
        const err: any = new Error('Article not found');
        err.statusCode = 404;
        throw err;
      }

      const perms = new Set<string>(user.permissions || []);
      const isAuthor = article.authorUserId === user.id;
      const canEdit = perms.has('brain.article.update_any') || (isAuthor && perms.has('brain.article.update_own'));

      if (!canEdit) {
        const err: any = new Error('Forbidden (permission)');
        err.statusCode = 403;
        throw err;
      }

      if (!['draft', 'changes_requested'].includes(article.status)) {
        const err: any = new Error(`Articles in "${article.status}" status cannot be edited directly`);
        err.statusCode = 400;
        throw err;
      }

      if (data.categoryId) {
        const cat = await db.KnowledgeCategory.findOne({
          where: { id: data.categoryId, businessId },
          transaction
        });
        if (!cat || cat.status === 'archived') {
          const err: any = new Error('Invalid or archived category');
          err.statusCode = 400;
          throw err;
        }
      }

      let newSlug = article.slug;
      if (data.title && data.title.trim() !== article.title) {
        newSlug = await this.generateUniqueSlug(businessId, data.title, article.id);
      }

      let content = article.content;
      let contentText = article.contentText;
      if (data.content !== undefined) {
        const sanitized = sanitizeArticleContent(data.content);
        content = sanitized.content;
        contentText = sanitized.contentText;
      }

      const newVersion = article.version + 1;

      await article.update({
        ...(data.title ? { title: data.title.trim() } : {}),
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        ...(data.content !== undefined ? { content, contentText } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId || null } : {}),
        ...(data.visibility ? { visibility: data.visibility } : {}),
        ...(data.metadata ? { metadata: { ...article.metadata, ...data.metadata } } : {}),
        slug: newSlug,
        version: newVersion
      }, { transaction });

      await db.KnowledgeRevision.create({
        businessId,
        articleId: article.id,
        revisedByUserId: user.id,
        version: newVersion,
        changeSummary: changeSummary || 'Updated article',
        contentSnapshot: {
          action: 'UPDATE',
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          content: article.content,
          contentText: article.contentText,
          categoryId: article.categoryId,
          visibility: article.visibility,
          status: article.status,
          metadata: article.metadata,
          version: newVersion,
          actorUserId: user.id,
          changeSummary: changeSummary || 'Updated article'
        }
      }, { transaction });

      return article;
    });
  }

  async getArticle(businessId: string, articleId: string, user: any) {
    const userDeptId = await this.getUserDepartmentId(user.id, businessId);
    const article = await db.KnowledgeArticle.findOne({
      where: { id: articleId, businessId },
      include: [{ model: db.KnowledgeCategory }]
    });

    if (!article) {
      const err: any = new Error('Article not found');
      err.statusCode = 404;
      throw err;
    }

    if (!this.canUserAccessArticle(user, article, userDeptId)) {
      const err: any = new Error('Article not found');
      err.statusCode = 404;
      throw err;
    }

    return article;
  }

  async listArticles(businessId: string, user: any, query: any) {
    const q = query || {};
    const page = Math.max(1, parseInt(q.page) || 1);
    const size = Math.min(100, Math.max(1, parseInt(q.size) || 20));
    const offset = (page - 1) * size;
    const userDeptId = await this.getUserDepartmentId(user.id, businessId);
    const perms = new Set<string>(user.permissions || []);

    const hasElevated = user.isPlatformSuperAdmin ||
                        perms.has('brain.article.update_any') ||
                        perms.has('brain.article.review') ||
                        perms.has('brain.article.publish');

    const where: any = { businessId };

    // Mandatory Rule 12: Query filters must NEVER bypass authorization scope
    if (!hasElevated) {
      if (q.mine === true || q.mine === 'true' || q.authorUserId === user.id) {
        where.authorUserId = user.id;
        if (q.status) {
          where.status = q.status;
        }
      } else {
        where.status = 'published';
        where[Op.or] = [
          { authorUserId: user.id },
          { visibility: 'company' },
          { visibility: 'department' }
        ];
      }
    } else {
      if (q.mine === true || q.mine === 'true') {
        where.authorUserId = user.id;
      } else if (q.authorUserId) {
        where.authorUserId = q.authorUserId;
      }
      if (q.status) {
        where.status = q.status;
      }
    }

    if (q.categoryId) {
      where.categoryId = q.categoryId;
    }

    if (q.visibility) {
      where.visibility = q.visibility;
    }

    if (q.search) {
      const searchClause = [
        { title: { [Op.iLike]: `%${q.search}%` } },
        { summary: { [Op.iLike]: `%${q.search}%` } },
        { contentText: { [Op.iLike]: `%${q.search}%` } }
      ];
      if (where[Op.or]) {
        where[Op.and] = [
          { [Op.or]: where[Op.or] },
          { [Op.or]: searchClause }
        ];
        delete where[Op.or];
      } else {
        where[Op.or] = searchClause;
      }
    }

    let paranoid = true;
    if (q.includeArchived === 'true' || q.includeArchived === true) {
      if (perms.has('brain.article.archive') || perms.has('brain.article.delete')) {
        // Allow includeArchived
      }
    }

    const sortBy = ['title', 'createdAt', 'updatedAt', 'publishedAt', 'version'].includes(q.sortBy)
      ? q.sortBy
      : 'updatedAt';
    const sortDir = (q.sortDirection || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const { rows, count } = await db.KnowledgeArticle.findAndCountAll({
      where,
      paranoid,
      offset,
      limit: size,
      include: [{ model: db.KnowledgeCategory }],
      order: [[sortBy, sortDir]]
    });

    // Filter department visibility in-memory if needed
    const filteredRows = rows.filter((art: any) => this.canUserAccessArticle(user, art, userDeptId));

    return {
      rows: filteredRows,
      count: filteredRows.length < rows.length ? filteredRows.length : count,
      page,
      size,
      pages: Math.ceil((filteredRows.length < rows.length ? filteredRows.length : count) / size)
    };
  }

  async deleteArticle(businessId: string, articleId: string, user: any) {
    const article = await db.KnowledgeArticle.findOne({ where: { id: articleId, businessId } });
    if (!article) {
      const err: any = new Error('Article not found');
      err.statusCode = 404;
      throw err;
    }

    if (!['draft', 'changes_requested', 'archived'].includes(article.status)) {
      const err: any = new Error('Only draft, changes_requested, or archived articles can be deleted');
      err.statusCode = 400;
      throw err;
    }

    await article.destroy();
    return { success: true, message: 'Article deleted successfully' };
  }

  async restoreArticle(businessId: string, articleId: string, user: any) {
    const article = await db.KnowledgeArticle.findOne({
      where: { id: articleId, businessId },
      paranoid: false
    });

    if (!article || !article.deletedAt) {
      const err: any = new Error('Soft-deleted article not found');
      err.statusCode = 404;
      throw err;
    }

    const existingSlug = await db.KnowledgeArticle.findOne({
      where: { businessId, slug: article.slug }
    });
    if (existingSlug) {
      const err: any = new Error('Article slug already exists in this business');
      err.statusCode = 409;
      throw err;
    }

    return db.sequelize.transaction(async (transaction: any) => {
      await article.restore({ transaction });
      const newVersion = article.version + 1;

      await article.update({
        status: 'draft',
        publishedAt: null,
        publishedByUserId: null,
        reviewedAt: null,
        reviewedByUserId: null,
        submittedAt: null,
        submittedByUserId: null,
        archivedAt: null,
        archivedByUserId: null,
        version: newVersion
      }, { transaction });

      await db.KnowledgeRevision.create({
        businessId,
        articleId: article.id,
        revisedByUserId: user.id,
        version: newVersion,
        changeSummary: 'Restored soft-deleted article',
        contentSnapshot: {
          action: 'RESTORE_ARTICLE',
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          content: article.content,
          contentText: article.contentText,
          categoryId: article.categoryId,
          visibility: article.visibility,
          status: 'draft',
          metadata: article.metadata,
          version: newVersion,
          actorUserId: user.id
        }
      }, { transaction });

      return article;
    });
  }

  // ── Workflow Actions ──

  async submitForReview(businessId: string, articleId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const article = await db.KnowledgeArticle.findOne({
        where: { id: articleId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!article) {
        const err: any = new Error('Article not found');
        err.statusCode = 404;
        throw err;
      }

      if (!['draft', 'changes_requested'].includes(article.status)) {
        const err: any = new Error(`Cannot submit article for review from status "${article.status}"`);
        err.statusCode = 400;
        throw err;
      }

      const perms = new Set<string>(user.permissions || []);
      const isAuthor = article.authorUserId === user.id;
      if (!isAuthor && !perms.has('brain.article.update_any')) {
        const err: any = new Error('Forbidden (permission)');
        err.statusCode = 403;
        throw err;
      }

      const now = new Date();
      await article.update({
        status: 'in_review',
        submittedAt: now,
        submittedByUserId: user.id
      }, { transaction });

      const newVersion = article.version + 1;
      await article.update({ version: newVersion }, { transaction });

      await db.KnowledgeRevision.create({
        businessId,
        articleId: article.id,
        revisedByUserId: user.id,
        version: newVersion,
        changeSummary: 'Submitted for review',
        contentSnapshot: {
          action: 'SUBMIT_REVIEW',
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          content: article.content,
          contentText: article.contentText,
          categoryId: article.categoryId,
          visibility: article.visibility,
          status: 'in_review',
          metadata: article.metadata,
          version: newVersion,
          actorUserId: user.id
        }
      }, { transaction });

      await this.notifyPublicationRequest(businessId, article.id, article.title);
      return article;
    });
  }

  async approveArticle(businessId: string, articleId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const article = await db.KnowledgeArticle.findOne({
        where: { id: articleId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!article) {
        const err: any = new Error('Article not found');
        err.statusCode = 404;
        throw err;
      }

      if (article.status !== 'in_review') {
        const err: any = new Error(`Cannot approve article from status "${article.status}"`);
        err.statusCode = 400;
        throw err;
      }

      if (article.submittedByUserId === user.id && !user.isPlatformSuperAdmin) {
        const err: any = new Error('You cannot approve an article you submitted for review');
        err.statusCode = 403;
        throw err;
      }

      const now = new Date();
      const newVersion = article.version + 1;

      await article.update({
        status: 'approved',
        reviewedAt: now,
        reviewedByUserId: user.id,
        version: newVersion
      }, { transaction });

      await db.KnowledgeRevision.create({
        businessId,
        articleId: article.id,
        revisedByUserId: user.id,
        version: newVersion,
        changeSummary: 'Article approved',
        contentSnapshot: {
          action: 'APPROVE',
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          content: article.content,
          contentText: article.contentText,
          categoryId: article.categoryId,
          visibility: article.visibility,
          status: 'approved',
          metadata: article.metadata,
          version: newVersion,
          actorUserId: user.id
        }
      }, { transaction });

      return article;
    });
  }

  async requestChanges(businessId: string, articleId: string, user: any, comment: string) {
    return db.sequelize.transaction(async (transaction: any) => {
      const article = await db.KnowledgeArticle.findOne({
        where: { id: articleId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!article) {
        const err: any = new Error('Article not found');
        err.statusCode = 404;
        throw err;
      }

      if (article.status !== 'in_review') {
        const err: any = new Error(`Cannot request changes from status "${article.status}"`);
        err.statusCode = 400;
        throw err;
      }

      const now = new Date();
      const newVersion = article.version + 1;
      const updatedMetadata = { ...article.metadata, reviewComment: comment };

      await article.update({
        status: 'changes_requested',
        reviewedAt: now,
        reviewedByUserId: user.id,
        metadata: updatedMetadata,
        version: newVersion
      }, { transaction });

      await db.KnowledgeRevision.create({
        businessId,
        articleId: article.id,
        revisedByUserId: user.id,
        version: newVersion,
        changeSummary: `Changes requested: ${comment}`,
        contentSnapshot: {
          action: 'REQUEST_CHANGES',
          reviewComment: comment,
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          content: article.content,
          contentText: article.contentText,
          categoryId: article.categoryId,
          visibility: article.visibility,
          status: 'changes_requested',
          metadata: updatedMetadata,
          version: newVersion,
          actorUserId: user.id
        }
      }, { transaction });

      // Notify author
      try {
        await InternalNotifier.send({
          businessId,
          recipientUserId: article.authorUserId,
          moduleKey: 'brain',
          type: 'changes_requested',
          title: 'Changes Requested on Article',
          message: `Changes were requested on your article "${article.title}": ${comment}`,
          entityType: 'brain_article',
          entityId: article.id
        });
      } catch {}

      return article;
    });
  }

  async publishArticle(businessId: string, articleId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const article = await db.KnowledgeArticle.findOne({
        where: { id: articleId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!article) {
        const err: any = new Error('Article not found');
        err.statusCode = 404;
        throw err;
      }

      if (article.status !== 'approved') {
        const err: any = new Error(`Only approved articles can be published (current status: "${article.status}")`);
        err.statusCode = 400;
        throw err;
      }

      const now = new Date();
      const newVersion = article.version + 1;

      await article.update({
        status: 'published',
        publishedAt: now,
        publishedByUserId: user.id,
        version: newVersion
      }, { transaction });

      await db.KnowledgeRevision.create({
        businessId,
        articleId: article.id,
        revisedByUserId: user.id,
        version: newVersion,
        changeSummary: 'Article published',
        contentSnapshot: {
          action: 'PUBLISH',
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          content: article.content,
          contentText: article.contentText,
          categoryId: article.categoryId,
          visibility: article.visibility,
          status: 'published',
          metadata: article.metadata,
          version: newVersion,
          actorUserId: user.id
        }
      }, { transaction });

      return article;
    });
  }

  async unpublishArticle(businessId: string, articleId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const article = await db.KnowledgeArticle.findOne({
        where: { id: articleId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!article) {
        const err: any = new Error('Article not found');
        err.statusCode = 404;
        throw err;
      }

      if (article.status !== 'published') {
        const err: any = new Error(`Only published articles can be unpublished (current status: "${article.status}")`);
        err.statusCode = 400;
        throw err;
      }

      // Mandatory Rule 8: Preserve old publication fields in revision snapshot before clearing
      const oldPublishedAt = article.publishedAt;
      const oldPublishedByUserId = article.publishedByUserId;
      const newVersion = article.version + 1;

      await article.update({
        status: 'draft',
        publishedAt: null,
        publishedByUserId: null,
        version: newVersion
      }, { transaction });

      await db.KnowledgeRevision.create({
        businessId,
        articleId: article.id,
        revisedByUserId: user.id,
        version: newVersion,
        changeSummary: 'Article unpublished',
        contentSnapshot: {
          action: 'UNPUBLISH',
          oldPublishedAt,
          oldPublishedByUserId,
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          content: article.content,
          contentText: article.contentText,
          categoryId: article.categoryId,
          visibility: article.visibility,
          status: 'draft',
          metadata: article.metadata,
          version: newVersion,
          actorUserId: user.id
        }
      }, { transaction });

      return article;
    });
  }

  async archiveArticle(businessId: string, articleId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const article = await db.KnowledgeArticle.findOne({
        where: { id: articleId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!article) {
        const err: any = new Error('Article not found');
        err.statusCode = 404;
        throw err;
      }

      if (!['draft', 'changes_requested', 'approved', 'published'].includes(article.status)) {
        const err: any = new Error(`Cannot archive article from status "${article.status}"`);
        err.statusCode = 400;
        throw err;
      }

      const now = new Date();
      const newVersion = article.version + 1;

      await article.update({
        status: 'archived',
        archivedAt: now,
        archivedByUserId: user.id,
        version: newVersion
      }, { transaction });

      await db.KnowledgeRevision.create({
        businessId,
        articleId: article.id,
        revisedByUserId: user.id,
        version: newVersion,
        changeSummary: 'Article archived',
        contentSnapshot: {
          action: 'ARCHIVE',
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          content: article.content,
          contentText: article.contentText,
          categoryId: article.categoryId,
          visibility: article.visibility,
          status: 'archived',
          metadata: article.metadata,
          version: newVersion,
          actorUserId: user.id
        }
      }, { transaction });

      return article;
    });
  }

  // ── Revisions ──

  async listRevisions(businessId: string, articleId: string, user: any, page: number, size: number) {
    const userDeptId = await this.getUserDepartmentId(user.id, businessId);

    // Mandatory Rule 10: Verify parent article existence & tenant matching
    const article = await db.KnowledgeArticle.findOne({
      where: { id: articleId, businessId }
    });
    if (!article) {
      const err: any = new Error('Article not found');
      err.statusCode = 404;
      throw err;
    }

    if (!this.canUserAccessArticle(user, article, userDeptId)) {
      const err: any = new Error('Article not found');
      err.statusCode = 404;
      throw err;
    }

    const p = Math.max(1, page || 1);
    const s = Math.min(100, Math.max(1, size || 20));
    const offset = (p - 1) * s;

    const { rows, count } = await db.KnowledgeRevision.findAndCountAll({
      where: { articleId, businessId },
      offset,
      limit: s,
      order: [['version', 'DESC']],
      include: (db.User ? [{ model: db.User, as: 'revisedBy', attributes: ['id', 'fullName', 'email'] }] : [])
    });

    return {
      rows,
      count,
      page: p,
      size: s,
      pages: Math.ceil(count / s)
    };
  }

  async getRevision(businessId: string, articleId: string, revisionId: string, user: any) {
    const userDeptId = await this.getUserDepartmentId(user.id, businessId);

    // Mandatory Rule 10: Verify parent article existence & tenant matching
    const article = await db.KnowledgeArticle.findOne({
      where: { id: articleId, businessId }
    });
    if (!article) {
      const err: any = new Error('Article not found');
      err.statusCode = 404;
      throw err;
    }

    if (!this.canUserAccessArticle(user, article, userDeptId)) {
      const err: any = new Error('Article not found');
      err.statusCode = 404;
      throw err;
    }

    const revision = await db.KnowledgeRevision.findOne({
      where: { id: revisionId, articleId, businessId },
      include: (db.User ? [{ model: db.User, as: 'revisedBy', attributes: ['id', 'fullName', 'email'] }] : [])
    });

    if (!revision) {
      const err: any = new Error('Revision not found');
      err.statusCode = 404;
      throw err;
    }

    return revision;
  }

  async restoreRevision(businessId: string, articleId: string, revisionId: string, user: any) {
    const userDeptId = await this.getUserDepartmentId(user.id, businessId);

    return db.sequelize.transaction(async (transaction: any) => {
      // Mandatory Rule 10: Verify parent article existence & tenant matching
      const article = await db.KnowledgeArticle.findOne({
        where: { id: articleId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!article) {
        const err: any = new Error('Article not found');
        err.statusCode = 404;
        throw err;
      }

      if (!this.canUserAccessArticle(user, article, userDeptId)) {
        const err: any = new Error('Article not found');
        err.statusCode = 404;
        throw err;
      }

      if (!['draft', 'changes_requested'].includes(article.status)) {
        const err: any = new Error(`Revisions can only be restored into draft or changes_requested articles (current status: "${article.status}")`);
        err.statusCode = 400;
        throw err;
      }

      const revision = await db.KnowledgeRevision.findOne({
        where: { id: revisionId, articleId, businessId },
        transaction
      });
      if (!revision) {
        const err: any = new Error('Revision not found');
        err.statusCode = 404;
        throw err;
      }

      const snapshot = revision.contentSnapshot || {};
      const { content, contentText } = sanitizeArticleContent(snapshot.content);

      const newVersion = article.version + 1;
      const updatedMetadata = {
        ...(article.metadata || {}),
        ...(snapshot.metadata || {}),
        restoredFromRevisionId: revisionId,
        restoredFromVersion: revision.version
      };

      await article.update({
        title: snapshot.title || article.title,
        summary: snapshot.summary !== undefined ? snapshot.summary : article.summary,
        content,
        contentText,
        categoryId: snapshot.categoryId || null,
        visibility: snapshot.visibility || article.visibility,
        metadata: updatedMetadata,
        version: newVersion
      }, { transaction });

      await db.KnowledgeRevision.create({
        businessId,
        articleId: article.id,
        revisedByUserId: user.id,
        version: newVersion,
        changeSummary: `Restored content from revision v${revision.version}`,
        contentSnapshot: {
          action: 'RESTORE_REVISION',
          restoredFromRevisionId: revisionId,
          restoredFromVersion: revision.version,
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          content: article.content,
          contentText: article.contentText,
          categoryId: article.categoryId,
          visibility: article.visibility,
          status: article.status,
          metadata: updatedMetadata,
          version: newVersion,
          actorUserId: user.id
        }
      }, { transaction });

      return article;
    });
  }

  // ── Training Materials ──

  async createTrainingMaterial(businessId: string, data: any) {
    if (data.categoryId) {
      const cat = await db.KnowledgeCategory.findOne({
        where: { id: data.categoryId, businessId }
      });
      if (!cat || cat.status === 'archived') {
        const err: any = new Error('Invalid or archived category');
        err.statusCode = 400;
        throw err;
      }
    }
    return db.TrainingMaterial.create({ ...data, businessId });
  }

  async updateTrainingMaterial(businessId: string, id: string, data: any) {
    const tm = await db.TrainingMaterial.findOne({ where: { id, businessId } });
    if (!tm) {
      const err: any = new Error('Training material not found');
      err.statusCode = 404;
      throw err;
    }
    if (data.categoryId) {
      const cat = await db.KnowledgeCategory.findOne({
        where: { id: data.categoryId, businessId }
      });
      if (!cat || cat.status === 'archived') {
        const err: any = new Error('Invalid or archived category');
        err.statusCode = 400;
        throw err;
      }
    }
    await tm.update(data);
    return tm;
  }

  async deleteTrainingMaterial(businessId: string, id: string) {
    const tm = await db.TrainingMaterial.findOne({ where: { id, businessId } });
    if (!tm) {
      const err: any = new Error('Training material not found');
      err.statusCode = 404;
      throw err;
    }
    await tm.destroy();
    return { success: true, message: 'Training material deleted successfully' };
  }

  async listTrainingMaterials(businessId: string, page: number, size: number) {
    const p = Math.max(1, page || 1);
    const s = Math.min(100, Math.max(1, size || 20));
    const offset = (p - 1) * s;

    const { rows, count } = await db.TrainingMaterial.findAndCountAll({
      where: { businessId },
      offset,
      limit: s,
      order: [['createdAt', 'DESC']]
    });

    return {
      rows,
      count,
      page: p,
      size: s,
      pages: Math.ceil(count / s)
    };
  }

  // ── Notifications ──

  async notifyPublicationRequest(businessId: string, articleId: string, title: string) {
    try {
      const managers = await db.UserRole.findAll({
        include: [{ model: db.Role, where: { key: ['KNOWLEDGE_MANAGER', 'BUSINESS_ADMIN'], businessId: [businessId, null] } }]
      });
      for (const m of managers) {
        await InternalNotifier.send({
          businessId,
          recipientUserId: m.userId,
          moduleKey: 'brain',
          type: 'publication_request',
          title: 'Knowledge Publication Request',
          message: `Article "${title}" has been submitted for review.`,
          entityType: 'brain_article',
          entityId: articleId
        });
      }
    } catch {}
  }
}
