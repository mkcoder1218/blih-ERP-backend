import { Op } from "sequelize";
import { db } from "../../models";
import { InternalNotifier } from "../notification/notification.service";
import { PolicyAssignmentService } from "./policy.assignment.service";
import { computePolicyContentHash, sanitizeArticleContent } from "./policy.sanitizer";

export class PolicyService {
  private assignmentService = new PolicyAssignmentService();

  // ── Helper: Slug Generation & Collision Check ────────────────────────────────────

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private async generateUniqueSlug(businessId: string, title: string, existingId?: string, transaction?: any): Promise<string> {
    const baseSlug = this.slugify(title) || "policy";
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const where: any = { businessId, slug };
      if (existingId) {
        where.id = { [Op.ne]: existingId };
      }
      const existing = await db.Policy.findOne({ where, transaction, paranoid: false });
      if (!existing) return slug;

      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  private slugifyKey(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // ── Categories Management ────────────────────────────────────────────────────────

  async createCategory(businessId: string, payload: any, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const key = payload.key ? this.slugifyKey(payload.key) : this.slugifyKey(payload.name);

      const existingKey = await db.PolicyCategory.findOne({
        where: { businessId, key },
        transaction
      });
      if (existingKey) {
        const err: any = new Error(`Category key "${key}" already exists in this business`);
        err.statusCode = 409;
        throw err;
      }

      if (payload.parentCategoryId) {
        const parent = await db.PolicyCategory.findOne({
          where: { id: payload.parentCategoryId, businessId },
          transaction
        });
        if (!parent) {
          const err: any = new Error("Parent category not found in this business");
          err.statusCode = 404;
          throw err;
        }
        if (parent.status === "archived" && payload.status === "active") {
          const err: any = new Error("Cannot create an active category under an archived parent category");
          err.statusCode = 400;
          throw err;
        }
      }

      const category = await db.PolicyCategory.create({
        businessId,
        parentCategoryId: payload.parentCategoryId || null,
        name: payload.name.trim(),
        key,
        description: payload.description || null,
        status: payload.status || "active",
        createdByUserId: user.id,
        updatedByUserId: user.id
      }, { transaction });

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_category",
        entityId: category.id,
        action: "CREATE_POLICY_CATEGORY",
        newState: category.toJSON()
      }, { transaction });

      return category;
    });
  }

  async listCategories(businessId: string, query: any) {
    const page = parseInt(query.page || "1", 10);
    const size = Math.min(parseInt(query.size || "20", 10), 100);
    const offset = (page - 1) * size;

    const where: any = { businessId };

    if (!query.includeArchived) {
      where.status = "active";
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.parentCategoryId) {
      where.parentCategoryId = query.parentCategoryId;
    }

    if (query.search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${query.search}%` } },
        { key: { [Op.iLike]: `%${query.search}%` } },
        { description: { [Op.iLike]: `%${query.search}%` } }
      ];
    }

    const { count, rows } = await db.PolicyCategory.findAndCountAll({
      where,
      limit: size,
      offset,
      order: [["name", "ASC"]],
      include: [{ model: db.PolicyCategory, as: "parentCategory", attributes: ["id", "name", "key"] }]
    });

    return {
      rows,
      count,
      page,
      size,
      pages: Math.ceil(count / size)
    };
  }

  async getCategory(businessId: string, categoryId: string) {
    const category = await db.PolicyCategory.findOne({
      where: { id: categoryId, businessId },
      include: [
        { model: db.PolicyCategory, as: "parentCategory", attributes: ["id", "name", "key"] },
        { model: db.PolicyCategory, as: "childCategories", attributes: ["id", "name", "key", "status"] }
      ]
    });
    if (!category) {
      const err: any = new Error("Category not found");
      err.statusCode = 404;
      throw err;
    }
    return category;
  }

  async updateCategory(businessId: string, categoryId: string, payload: any, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const category = await db.PolicyCategory.findOne({
        where: { id: categoryId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!category) {
        const err: any = new Error("Category not found");
        err.statusCode = 404;
        throw err;
      }

      const previousState = category.toJSON();
      const updates: any = { updatedByUserId: user.id };

      if (payload.name) updates.name = payload.name.trim();

      if (payload.key) {
        const newKey = this.slugifyKey(payload.key);
        if (newKey !== category.key) {
          const existingKey = await db.PolicyCategory.findOne({
            where: { businessId, key: newKey, id: { [Op.ne]: category.id } },
            transaction
          });
          if (existingKey) {
            const err: any = new Error(`Category key "${newKey}" already exists in this business`);
            err.statusCode = 409;
            throw err;
          }
          updates.key = newKey;
        }
      }

      if (payload.parentCategoryId !== undefined) {
        if (payload.parentCategoryId === category.id) {
          const err: any = new Error("A category cannot be its own parent");
          err.statusCode = 400;
          throw err;
        }

        if (payload.parentCategoryId) {
          const parent = await db.PolicyCategory.findOne({
            where: { id: payload.parentCategoryId, businessId },
            transaction
          });
          if (!parent) {
            const err: any = new Error("Parent category not found in this business");
            err.statusCode = 404;
            throw err;
          }

          // Check circular ancestry
          let currentParentId = parent.parentCategoryId;
          while (currentParentId) {
            if (currentParentId === category.id) {
              const err: any = new Error("Circular parent category reference detected");
              err.statusCode = 400;
              throw err;
            }
            const nextParent = await db.PolicyCategory.findOne({
              where: { id: currentParentId, businessId },
              transaction
            });
            currentParentId = nextParent ? nextParent.parentCategoryId : null;
          }

          updates.parentCategoryId = payload.parentCategoryId;
        } else {
          updates.parentCategoryId = null;
        }
      }

      if (payload.description !== undefined) updates.description = payload.description || null;
      if (payload.status) updates.status = payload.status;

      await category.update(updates, { transaction });

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_category",
        entityId: category.id,
        action: "UPDATE_POLICY_CATEGORY",
        previousState,
        newState: category.toJSON()
      }, { transaction });

      return category;
    });
  }

  async deleteCategory(businessId: string, categoryId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const category = await db.PolicyCategory.findOne({
        where: { id: categoryId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!category) {
        const err: any = new Error("Category not found");
        err.statusCode = 404;
        throw err;
      }

      // Check active child categories
      const activeChildren = await db.PolicyCategory.count({
        where: { parentCategoryId: category.id, businessId, status: "active" },
        transaction
      });
      if (activeChildren > 0) {
        const err: any = new Error("Cannot delete category with active child categories");
        err.statusCode = 400;
        throw err;
      }

      // Check non-deleted policies
      const nonDeletedPolicies = await db.Policy.count({
        where: { categoryId: category.id, businessId },
        transaction
      });
      if (nonDeletedPolicies > 0) {
        const err: any = new Error("Cannot delete category containing existing policies");
        err.statusCode = 400;
        throw err;
      }

      const previousState = category.toJSON();
      await category.destroy({ transaction });

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_category",
        entityId: category.id,
        action: "DELETE_POLICY_CATEGORY",
        previousState
      }, { transaction });

      return { success: true, message: "Category deleted successfully" };
    });
  }

  async restoreCategory(businessId: string, categoryId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const category = await db.PolicyCategory.findOne({
        where: { id: categoryId, businessId },
        paranoid: false,
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!category || !category.deletedAt) {
        const err: any = new Error("Deleted category not found");
        err.statusCode = 404;
        throw err;
      }

      // Check duplicate key conflict
      const activeDuplicate = await db.PolicyCategory.findOne({
        where: { businessId, key: category.key, id: { [Op.ne]: category.id } },
        transaction
      });
      if (activeDuplicate) {
        const err: any = new Error(`Cannot restore category. Key "${category.key}" is currently used by an active category.`);
        err.statusCode = 409;
        throw err;
      }

      await category.restore({ transaction });
      await category.update({ status: "active", updatedByUserId: user.id }, { transaction });

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_category",
        entityId: category.id,
        action: "RESTORE_POLICY_CATEGORY",
        newState: category.toJSON()
      }, { transaction });

      return category;
    });
  }

  // ── Policy Document CRUD ──────────────────────────────────────────────────────────

  async createPolicy(businessId: string, payload: any, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const title = payload.title.trim();
      const slug = await this.generateUniqueSlug(businessId, payload.slug || title, undefined, transaction);
      const { content: sanitizedHtml, contentText } = sanitizeArticleContent(payload.contentHtml);

      const policy = await db.Policy.create({
        businessId,
        categoryId: payload.categoryId || null,
        policyType: payload.policyType ? payload.policyType.toUpperCase() : "GENERAL",
        title,
        slug,
        summary: payload.summary || null,
        contentHtml: sanitizedHtml,
        contentJson: payload.contentJson || null,
        contentText,
        version: 1,
        versionLabel: payload.versionLabel || "v1.0",
        status: "draft",
        visibility: payload.visibility || "company",
        confidentialityLevel: payload.confidentialityLevel || "normal",
        isRequired: payload.isRequired !== undefined ? payload.isRequired : true,
        requiresAcceptance: payload.requiresAcceptance !== undefined ? payload.requiresAcceptance : true,
        requiresSignature: payload.requiresSignature !== undefined ? payload.requiresSignature : false,
        requiresReacceptanceOnUpdate: payload.requiresReacceptanceOnUpdate !== undefined ? payload.requiresReacceptanceOnUpdate : true,
        effectiveFrom: payload.effectiveFrom || null,
        effectiveUntil: payload.effectiveUntil || null,
        reviewDueAt: payload.reviewDueAt || null,
        ownerUserId: payload.ownerUserId || user.id,
        ownerDepartmentId: payload.ownerDepartmentId || null,
        createdById: user.id,
        updatedById: user.id,
        appliesToAllEmployees: payload.appliesToAllEmployees !== undefined ? payload.appliesToAllEmployees : true,
        publicShareEnabled: false,
        metadata: payload.metadata || {}
      }, { transaction });

      const contentHash = computePolicyContentHash({
        policyId: policy.id,
        version: 1,
        title: policy.title,
        contentHtml: policy.contentHtml,
        effectiveFrom: policy.effectiveFrom,
        effectiveUntil: policy.effectiveUntil,
        requiresAcceptance: policy.requiresAcceptance,
        requiresSignature: policy.requiresSignature
      });

      // Initial Version 1 Snapshot
      await db.PolicyVersion.create({
        businessId,
        policyId: policy.id,
        version: 1,
        versionLabel: policy.versionLabel,
        title: policy.title,
        slug: policy.slug,
        policyType: policy.policyType,
        summary: policy.summary,
        contentHtml: policy.contentHtml,
        contentJson: policy.contentJson,
        contentText: policy.contentText,
        contentHash,
        visibility: policy.visibility,
        confidentialityLevel: policy.confidentialityLevel,
        effectiveFrom: policy.effectiveFrom,
        effectiveUntil: policy.effectiveUntil,
        requiresAcceptance: policy.requiresAcceptance,
        requiresSignature: policy.requiresSignature,
        assignmentSnapshot: [],
        metadataSnapshot: policy.metadata,
        statusAtCreation: "draft",
        action: "CREATE_POLICY",
        createdByUserId: user.id
      }, { transaction });

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_document",
        entityId: policy.id,
        action: "CREATE_POLICY",
        newState: { id: policy.id, title: policy.title, version: 1, status: "draft" }
      }, { transaction });

      return policy;
    });
  }

  async listPolicies(businessId: string, user: any, query: any) {
    const page = parseInt(query.page || "1", 10);
    const size = Math.min(parseInt(query.size || "20", 10), 100);
    const offset = (page - 1) * size;

    const where: any = { businessId };

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.policyType) where.policyType = query.policyType.toUpperCase();
    if (query.status) where.status = query.status;
    if (query.visibility) where.visibility = query.visibility;
    if (query.confidentialityLevel) where.confidentialityLevel = query.confidentialityLevel;
    if (query.ownerUserId) where.ownerUserId = query.ownerUserId;

    if (!query.includeArchived && !query.status) {
      where.status = { [Op.ne]: "archived" };
    }

    // Role-based visibility filter for standard readers
    const isElevated = user.isPlatformSuperAdmin ||
      (user.permissions && (user.permissions.includes("policy.document.update_any") || user.permissions.includes("policy.document.review")));

    if (!isElevated) {
      where[Op.and] = [
        { status: "published" },
        { [Op.or]: [{ visibility: "company" }, { ownerUserId: user.id }] }
      ];
    }

    if (query.search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${query.search}%` } },
        { slug: { [Op.iLike]: `%${query.search}%` } },
        { summary: { [Op.iLike]: `%${query.search}%` } }
      ];
    }

    const { count, rows } = await db.Policy.findAndCountAll({
      where,
      limit: size,
      offset,
      order: [[query.sortBy || "createdAt", query.sortDirection || "DESC"]],
      include: [
        { model: db.PolicyCategory, as: "category", attributes: ["id", "name", "key"] },
        { model: db.User, as: "createdBy", attributes: ["id", "fullName", "email"] }
      ]
    });

    return {
      rows,
      count,
      page,
      size,
      pages: Math.ceil(count / size)
    };
  }

  async getPolicy(businessId: string, policyId: string, user: any) {
    const policy = await db.Policy.findOne({
      where: { id: policyId, businessId },
      include: [
        { model: db.PolicyCategory, as: "category", attributes: ["id", "name", "key"] },
        { model: db.User, as: "createdBy", attributes: ["id", "fullName", "email"] },
        { model: db.User, as: "owner", attributes: ["id", "fullName", "email"] }
      ]
    });

    if (!policy) {
      const err: any = new Error("Policy not found");
      err.statusCode = 404;
      throw err;
    }

    const isElevated = user.isPlatformSuperAdmin ||
      (user.permissions && (user.permissions.includes("policy.document.update_any") || user.permissions.includes("policy.document.review")));

    if (policy.status !== "published" && policy.ownerUserId !== user.id && !isElevated) {
      const err: any = new Error("You are not authorized to view this unpublished policy");
      err.statusCode = 403;
      throw err;
    }

    return policy;
  }

  async updatePolicy(businessId: string, policyId: string, payload: any, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!policy) {
        const err: any = new Error("Policy not found");
        err.statusCode = 404;
        throw err;
      }

      if (!["draft", "changes_requested"].includes(policy.status)) {
        const err: any = new Error(`Cannot modify policy in status "${policy.status}". Only draft or changes_requested policies can be updated.`);
        err.statusCode = 400;
        throw err;
      }

      const isOwner = policy.ownerUserId === user.id || policy.createdById === user.id;
      const canUpdateAny = user.permissions && user.permissions.includes("policy.document.update_any");
      if (!isOwner && !canUpdateAny && !user.isPlatformSuperAdmin) {
        const err: any = new Error("You are not authorized to update this policy");
        err.statusCode = 403;
        throw err;
      }

      const previousState = policy.toJSON();
      const newVersion = policy.version + 1;
      const updates: any = {
        version: newVersion,
        updatedById: user.id
      };

      if (payload.title) {
        updates.title = payload.title.trim();
        if (!payload.slug) {
          updates.slug = await this.generateUniqueSlug(businessId, updates.title, policy.id, transaction);
        }
      }
      if (payload.slug) {
        updates.slug = await this.generateUniqueSlug(businessId, payload.slug, policy.id, transaction);
      }
      if (payload.summary !== undefined) updates.summary = payload.summary || null;
      if (payload.policyType) updates.policyType = payload.policyType.toUpperCase();
      if (payload.categoryId !== undefined) updates.categoryId = payload.categoryId || null;

      if (payload.contentHtml !== undefined) {
        const { content: sanitizedHtml, contentText } = sanitizeArticleContent(payload.contentHtml);
        updates.contentHtml = sanitizedHtml;
        updates.contentText = contentText;
      }
      if (payload.contentJson !== undefined) updates.contentJson = payload.contentJson || null;
      if (payload.visibility) updates.visibility = payload.visibility;
      if (payload.confidentialityLevel) updates.confidentialityLevel = payload.confidentialityLevel;
      if (payload.versionLabel !== undefined) updates.versionLabel = payload.versionLabel || `v${newVersion}.0`;
      if (payload.isRequired !== undefined) updates.isRequired = payload.isRequired;
      if (payload.requiresAcceptance !== undefined) updates.requiresAcceptance = payload.requiresAcceptance;
      if (payload.requiresSignature !== undefined) updates.requiresSignature = payload.requiresSignature;
      if (payload.requiresReacceptanceOnUpdate !== undefined) updates.requiresReacceptanceOnUpdate = payload.requiresReacceptanceOnUpdate;
      if (payload.effectiveFrom !== undefined) updates.effectiveFrom = payload.effectiveFrom || null;
      if (payload.effectiveUntil !== undefined) updates.effectiveUntil = payload.effectiveUntil || null;
      if (payload.reviewDueAt !== undefined) updates.reviewDueAt = payload.reviewDueAt || null;
      if (payload.ownerUserId !== undefined) updates.ownerUserId = payload.ownerUserId || null;
      if (payload.ownerDepartmentId !== undefined) updates.ownerDepartmentId = payload.ownerDepartmentId || null;
      if (payload.appliesToAllEmployees !== undefined) updates.appliesToAllEmployees = payload.appliesToAllEmployees;
      if (payload.metadata) updates.metadata = { ...policy.metadata, ...payload.metadata };

      await policy.update(updates, { transaction });

      const contentHash = computePolicyContentHash({
        policyId: policy.id,
        version: newVersion,
        title: policy.title,
        contentHtml: policy.contentHtml,
        effectiveFrom: policy.effectiveFrom,
        effectiveUntil: policy.effectiveUntil,
        requiresAcceptance: policy.requiresAcceptance,
        requiresSignature: policy.requiresSignature
      });

      // Immutable PolicyVersion snapshot on update
      await db.PolicyVersion.create({
        businessId,
        policyId: policy.id,
        version: newVersion,
        versionLabel: policy.versionLabel,
        title: policy.title,
        slug: policy.slug,
        policyType: policy.policyType,
        summary: policy.summary,
        contentHtml: policy.contentHtml,
        contentJson: policy.contentJson,
        contentText: policy.contentText,
        contentHash,
        visibility: policy.visibility,
        confidentialityLevel: policy.confidentialityLevel,
        effectiveFrom: policy.effectiveFrom,
        effectiveUntil: policy.effectiveUntil,
        requiresAcceptance: policy.requiresAcceptance,
        requiresSignature: policy.requiresSignature,
        assignmentSnapshot: [],
        metadataSnapshot: policy.metadata,
        statusAtCreation: policy.status,
        action: "UPDATE_POLICY",
        changeSummary: payload.changeSummary || "Policy content updated",
        createdByUserId: user.id
      }, { transaction });

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_document",
        entityId: policy.id,
        action: "UPDATE_POLICY",
        previousState: { version: previousState.version, status: previousState.status },
        newState: { version: newVersion, status: policy.status }
      }, { transaction });

      return policy;
    });
  }

  async deletePolicy(businessId: string, policyId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!policy) {
        const err: any = new Error("Policy not found");
        err.statusCode = 404;
        throw err;
      }

      if (!["draft", "changes_requested", "archived"].includes(policy.status)) {
        const err: any = new Error(`Cannot delete policy in status "${policy.status}". Only draft, changes_requested, or archived policies may be deleted.`);
        err.statusCode = 400;
        throw err;
      }

      const previousState = policy.toJSON();
      await policy.destroy({ transaction });

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_document",
        entityId: policy.id,
        action: "DELETE_POLICY",
        previousState: { id: policy.id, title: policy.title, status: previousState.status }
      }, { transaction });

      return { success: true, message: "Policy deleted successfully" };
    });
  }

  async restorePolicy(businessId: string, policyId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId },
        paranoid: false,
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!policy || !policy.deletedAt) {
        const err: any = new Error("Deleted policy not found");
        err.statusCode = 404;
        throw err;
      }

      // Check slug collision
      const activeDuplicate = await db.Policy.findOne({
        where: { businessId, slug: policy.slug, id: { [Op.ne]: policy.id } },
        transaction
      });
      if (activeDuplicate) {
        const err: any = new Error(`Cannot restore policy. Slug "${policy.slug}" is currently used by an active policy.`);
        err.statusCode = 409;
        throw err;
      }

      await policy.restore({ transaction });
      await policy.update({
        status: "draft",
        updatedById: user.id
      }, { transaction });

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_document",
        entityId: policy.id,
        action: "RESTORE_POLICY",
        newState: { id: policy.id, title: policy.title, status: "draft" }
      }, { transaction });

      return policy;
    });
  }

  // ── Workflow Transitions ──────────────────────────────────────────────────────────

  async submitForReview(businessId: string, policyId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!policy) {
        const err: any = new Error("Policy not found");
        err.statusCode = 404;
        throw err;
      }

      if (!["draft", "changes_requested"].includes(policy.status)) {
        const err: any = new Error(`Cannot submit policy for review from status "${policy.status}"`);
        err.statusCode = 400;
        throw err;
      }

      const now = new Date();
      await policy.update({
        status: "in_review",
        submittedAt: now,
        submittedByUserId: user.id,
        updatedById: user.id
      }, { transaction });

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_document",
        entityId: policy.id,
        action: "SUBMIT_POLICY_REVIEW",
        newState: { status: "in_review", submittedAt: now }
      }, { transaction });

      return policy;
    });
  }

  async requestChanges(businessId: string, policyId: string, user: any, comment: string) {
    return db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!policy) {
        const err: any = new Error("Policy not found");
        err.statusCode = 404;
        throw err;
      }

      if (policy.status !== "in_review") {
        const err: any = new Error(`Cannot request changes from status "${policy.status}"`);
        err.statusCode = 400;
        throw err;
      }

      const now = new Date();
      await policy.update({
        status: "changes_requested",
        reviewedAt: now,
        reviewedByUserId: user.id,
        metadata: { ...policy.metadata, lastReviewComment: comment },
        updatedById: user.id
      }, { transaction });

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_document",
        entityId: policy.id,
        action: "REQUEST_POLICY_CHANGES",
        newState: { status: "changes_requested", reviewComment: comment }
      }, { transaction });

      // Notify owner
      if (policy.ownerUserId) {
        try {
          await InternalNotifier.send({
            businessId,
            recipientUserId: policy.ownerUserId,
            moduleKey: "policy",
            type: "changes_requested",
            title: "Policy Changes Requested",
            message: `Changes were requested on policy "${policy.title}": ${comment}`,
            entityType: "policy",
            entityId: policy.id
          });
        } catch {}
      }

      return policy;
    });
  }

  async approvePolicy(businessId: string, policyId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!policy) {
        const err: any = new Error("Policy not found");
        err.statusCode = 404;
        throw err;
      }

      if (policy.status !== "in_review") {
        const err: any = new Error(`Cannot approve policy from status "${policy.status}"`);
        err.statusCode = 400;
        throw err;
      }

      // Mandatory anti-self approval check
      if (policy.submittedByUserId === user.id && !user.isPlatformSuperAdmin) {
        const err: any = new Error("You cannot approve a policy you submitted for review");
        err.statusCode = 403;
        throw err;
      }

      const now = new Date();
      await policy.update({
        status: "approved",
        approvedAt: now,
        approvedByUserId: user.id,
        updatedById: user.id
      }, { transaction });

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_document",
        entityId: policy.id,
        action: "APPROVE_POLICY",
        newState: { status: "approved", approvedAt: now }
      }, { transaction });

      if (policy.ownerUserId) {
        try {
          await InternalNotifier.send({
            businessId,
            recipientUserId: policy.ownerUserId,
            moduleKey: "policy",
            type: "policy_approved",
            title: "Policy Approved",
            message: `Your policy "${policy.title}" has been approved.`,
            entityType: "policy",
            entityId: policy.id
          });
        } catch {}
      }

      return policy;
    });
  }

  async schedulePolicy(businessId: string, policyId: string, user: any, effectiveFrom: Date) {
    return db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!policy) {
        const err: any = new Error("Policy not found");
        err.statusCode = 404;
        throw err;
      }

      if (policy.status !== "approved") {
        const err: any = new Error(`Cannot schedule policy from status "${policy.status}". Only approved policies can be scheduled.`);
        err.statusCode = 400;
        throw err;
      }

      if (new Date(effectiveFrom).getTime() <= Date.now()) {
        const err: any = new Error("effectiveFrom must be a future date for scheduling");
        err.statusCode = 400;
        throw err;
      }

      await policy.update({
        status: "scheduled",
        effectiveFrom,
        updatedById: user.id
      }, { transaction });

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_document",
        entityId: policy.id,
        action: "SCHEDULE_POLICY",
        newState: { status: "scheduled", effectiveFrom }
      }, { transaction });

      return policy;
    });
  }

  async publishPolicy(businessId: string, policyId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!policy) {
        const err: any = new Error("Policy not found");
        err.statusCode = 404;
        throw err;
      }

      if (!["approved", "scheduled"].includes(policy.status)) {
        const err: any = new Error(`Cannot publish policy from status "${policy.status}". Only approved or scheduled policies can be published.`);
        err.statusCode = 400;
        throw err;
      }

      const now = new Date();
      const contentHash = computePolicyContentHash({
        policyId: policy.id,
        version: policy.version,
        title: policy.title,
        contentHtml: policy.contentHtml,
        effectiveFrom: policy.effectiveFrom || now,
        effectiveUntil: policy.effectiveUntil,
        requiresAcceptance: policy.requiresAcceptance,
        requiresSignature: policy.requiresSignature
      });

      // Fetch assignments to freeze snapshot
      const assignments = await db.PolicyAssignment.findAll({
        where: { policyId: policy.id, businessId },
        transaction
      });
      const assignmentSnapshot = assignments.map((a: any) => a.toJSON());

      // Create/Update published version snapshot
      const [version] = await db.PolicyVersion.findOrCreate({
        where: { policyId: policy.id, version: policy.version },
        defaults: {
          businessId,
          policyId: policy.id,
          version: policy.version,
          versionLabel: policy.versionLabel || `v${policy.version}.0`,
          title: policy.title,
          slug: policy.slug,
          policyType: policy.policyType,
          summary: policy.summary,
          contentHtml: policy.contentHtml,
          contentJson: policy.contentJson,
          contentText: policy.contentText,
          contentHash,
          visibility: policy.visibility,
          confidentialityLevel: policy.confidentialityLevel,
          effectiveFrom: policy.effectiveFrom || now,
          effectiveUntil: policy.effectiveUntil,
          requiresAcceptance: policy.requiresAcceptance,
          requiresSignature: policy.requiresSignature,
          assignmentSnapshot,
          metadataSnapshot: policy.metadata,
          statusAtCreation: "published",
          action: "PUBLISH_POLICY",
          createdByUserId: user.id
        },
        transaction
      });

      await policy.update({
        status: "published",
        publishedAt: now,
        publishedByUserId: user.id,
        effectiveFrom: policy.effectiveFrom || now,
        updatedById: user.id
      }, { transaction });

      // Generate obligations in bounded chunks
      await this.assignmentService.generateAcceptanceObligations(
        businessId,
        policy,
        version,
        assignments,
        transaction
      );

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_document",
        entityId: policy.id,
        action: "PUBLISH_POLICY",
        newState: { status: "published", publishedAt: now, version: policy.version }
      }, { transaction });

      return policy;
    });
  }

  async unpublishPolicy(businessId: string, policyId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!policy) {
        const err: any = new Error("Policy not found");
        err.statusCode = 404;
        throw err;
      }

      if (policy.status !== "published") {
        const err: any = new Error(`Cannot unpublish policy from status "${policy.status}". Only published policies can be unpublished.`);
        err.statusCode = 400;
        throw err;
      }

      const now = new Date();
      await policy.update({
        status: "approved",
        publicShareEnabled: false,
        updatedById: user.id
      }, { transaction });

      // Revoke public shares
      await db.PolicyPublicShare.update({
        enabled: false,
        revokedAt: now
      }, {
        where: { policyId: policy.id, businessId, enabled: true },
        transaction
      });

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_document",
        entityId: policy.id,
        action: "UNPUBLISH_POLICY",
        newState: { status: "approved", unpublishedAt: now }
      }, { transaction });

      return policy;
    });
  }

  async supersedePolicy(businessId: string, policyId: string, user: any, replacementPolicyId: string) {
    return db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!policy) {
        const err: any = new Error("Policy to supersede not found");
        err.statusCode = 404;
        throw err;
      }

      const replacement = await db.Policy.findOne({
        where: { id: replacementPolicyId, businessId },
        transaction
      });

      if (!replacement) {
        const err: any = new Error("Replacement policy not found");
        err.statusCode = 404;
        throw err;
      }

      await policy.update({
        status: "superseded",
        supersededByPolicyId: replacement.id,
        supersededByVersionId: replacement.version,
        updatedById: user.id
      }, { transaction });

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_document",
        entityId: policy.id,
        action: "SUPERSEDE_POLICY",
        newState: { status: "superseded", supersededByPolicyId: replacement.id }
      }, { transaction });

      return policy;
    });
  }

  async archivePolicy(businessId: string, policyId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!policy) {
        const err: any = new Error("Policy not found");
        err.statusCode = 404;
        throw err;
      }

      const now = new Date();
      await policy.update({
        status: "archived",
        archivedAt: now,
        archivedByUserId: user.id,
        publicShareEnabled: false,
        updatedById: user.id
      }, { transaction });

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_document",
        entityId: policy.id,
        action: "ARCHIVE_POLICY",
        newState: { status: "archived", archivedAt: now }
      }, { transaction });

      return policy;
    });
  }

  // ── Version History & Restoration ────────────────────────────────────────────────

  async listVersions(businessId: string, policyId: string) {
    const policy = await db.Policy.findOne({ where: { id: policyId, businessId } });
    if (!policy) {
      const err: any = new Error("Policy not found");
      err.statusCode = 404;
      throw err;
    }

    const versions = await db.PolicyVersion.findAll({
      where: { policyId: policy.id, businessId },
      order: [["version", "DESC"]],
      include: [{ model: db.User, as: "createdBy", attributes: ["id", "fullName", "email"] }]
    });

    return versions;
  }

  async getVersion(businessId: string, policyId: string, versionId: string) {
    const policy = await db.Policy.findOne({ where: { id: policyId, businessId } });
    if (!policy) {
      const err: any = new Error("Policy not found");
      err.statusCode = 404;
      throw err;
    }

    const version = await db.PolicyVersion.findOne({
      where: { id: versionId, policyId: policy.id, businessId }
    });

    if (!version) {
      const err: any = new Error("Policy version not found for this document");
      err.statusCode = 404;
      throw err;
    }

    return version;
  }

  async restoreVersion(businessId: string, policyId: string, versionId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!policy) {
        const err: any = new Error("Policy not found");
        err.statusCode = 404;
        throw err;
      }

      const versionToRestore = await db.PolicyVersion.findOne({
        where: { id: versionId, policyId: policy.id, businessId },
        transaction
      });

      if (!versionToRestore) {
        const err: any = new Error("Policy version not found for this document");
        err.statusCode = 404;
        throw err;
      }

      const newVersion = policy.version + 1;
      const { content: sanitizedHtml, contentText } = sanitizeArticleContent(versionToRestore.contentHtml);

      await policy.update({
        title: versionToRestore.title,
        summary: versionToRestore.summary,
        contentHtml: sanitizedHtml,
        contentJson: versionToRestore.contentJson,
        contentText,
        version: newVersion,
        versionLabel: `v${newVersion}.0 (Restored from v${versionToRestore.version})`,
        status: "draft",
        updatedById: user.id
      }, { transaction });

      const contentHash = computePolicyContentHash({
        policyId: policy.id,
        version: newVersion,
        title: policy.title,
        contentHtml: policy.contentHtml,
        effectiveFrom: policy.effectiveFrom,
        effectiveUntil: policy.effectiveUntil,
        requiresAcceptance: policy.requiresAcceptance,
        requiresSignature: policy.requiresSignature
      });

      // Restore creates a NEW higher version number
      const newVersionRecord = await db.PolicyVersion.create({
        businessId,
        policyId: policy.id,
        version: newVersion,
        versionLabel: policy.versionLabel,
        title: policy.title,
        slug: policy.slug,
        policyType: policy.policyType,
        summary: policy.summary,
        contentHtml: policy.contentHtml,
        contentJson: policy.contentJson,
        contentText: policy.contentText,
        contentHash,
        visibility: policy.visibility,
        confidentialityLevel: policy.confidentialityLevel,
        effectiveFrom: policy.effectiveFrom,
        effectiveUntil: policy.effectiveUntil,
        requiresAcceptance: policy.requiresAcceptance,
        requiresSignature: policy.requiresSignature,
        assignmentSnapshot: [],
        metadataSnapshot: policy.metadata,
        statusAtCreation: "draft",
        action: "RESTORE_POLICY_VERSION",
        changeSummary: `Restored content from version ${versionToRestore.version}`,
        restoredFromVersionId: versionToRestore.id,
        createdByUserId: user.id
      }, { transaction });

      await db.AuditLog.create({
        businessId,
        actorUserId: user.id,
        entityType: "policy_document",
        entityId: policy.id,
        action: "RESTORE_POLICY_VERSION",
        newState: { newVersion, restoredFromVersion: versionToRestore.version }
      }, { transaction });

      return policy;
    });
  }
}
