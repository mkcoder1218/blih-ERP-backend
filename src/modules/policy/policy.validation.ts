import Joi from "joi";

export const categoryIdParamSchema = Joi.object({
  id: Joi.string().uuid().required()
});

export const policyIdParamSchema = Joi.object({
  id: Joi.string().uuid().required()
});

export const versionIdParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
  versionId: Joi.string().uuid().required()
});

export const createCategorySchema = Joi.object({
  name: Joi.string().max(255).trim().required(),
  key: Joi.string().max(160).trim().optional(),
  description: Joi.string().max(2000).allow('', null).optional(),
  parentCategoryId: Joi.string().uuid().allow(null).optional(),
  status: Joi.string().valid('active', 'archived').default('active')
});

export const updateCategorySchema = Joi.object({
  name: Joi.string().max(255).trim().optional(),
  key: Joi.string().max(160).trim().optional(),
  description: Joi.string().max(2000).allow('', null).optional(),
  parentCategoryId: Joi.string().uuid().allow(null).optional(),
  status: Joi.string().valid('active', 'archived').optional()
});

export const listCategoriesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow('').optional(),
  status: Joi.string().valid('active', 'archived').optional(),
  parentCategoryId: Joi.string().uuid().allow(null).optional(),
  includeArchived: Joi.boolean().optional()
});

export const createPolicySchema = Joi.object({
  title: Joi.string().max(255).trim().required(),
  slug: Joi.string().max(160).trim().optional(),
  policyType: Joi.string().max(120).trim().default('GENERAL'),
  categoryId: Joi.string().uuid().allow(null).optional(),
  summary: Joi.string().max(2000).allow('', null).optional(),
  contentHtml: Joi.string().required(),
  contentJson: Joi.object().allow(null).optional(),
  visibility: Joi.string().valid('company', 'department', 'private', 'public').default('company'),
  confidentialityLevel: Joi.string().valid('normal', 'confidential', 'restricted').default('normal'),
  versionLabel: Joi.string().max(80).trim().allow('', null).optional(),
  isRequired: Joi.boolean().default(true),
  requiresAcceptance: Joi.boolean().default(true),
  requiresSignature: Joi.boolean().default(false),
  requiresReacceptanceOnUpdate: Joi.boolean().default(true),
  effectiveFrom: Joi.date().iso().allow(null).optional(),
  effectiveUntil: Joi.date().iso().greater(Joi.ref('effectiveFrom')).allow(null).optional(),
  reviewDueAt: Joi.date().iso().allow(null).optional(),
  ownerUserId: Joi.string().uuid().allow(null).optional(),
  ownerDepartmentId: Joi.string().uuid().allow(null).optional(),
  appliesToAllEmployees: Joi.boolean().default(true),
  metadata: Joi.object().optional()
});

export const updatePolicySchema = Joi.object({
  title: Joi.string().max(255).trim().optional(),
  slug: Joi.string().max(160).trim().optional(),
  policyType: Joi.string().max(120).trim().optional(),
  categoryId: Joi.string().uuid().allow(null).optional(),
  summary: Joi.string().max(2000).allow('', null).optional(),
  contentHtml: Joi.string().optional(),
  contentJson: Joi.object().allow(null).optional(),
  visibility: Joi.string().valid('company', 'department', 'private', 'public').optional(),
  confidentialityLevel: Joi.string().valid('normal', 'confidential', 'restricted').optional(),
  versionLabel: Joi.string().max(80).trim().allow('', null).optional(),
  isRequired: Joi.boolean().optional(),
  requiresAcceptance: Joi.boolean().optional(),
  requiresSignature: Joi.boolean().optional(),
  requiresReacceptanceOnUpdate: Joi.boolean().optional(),
  effectiveFrom: Joi.date().iso().allow(null).optional(),
  effectiveUntil: Joi.date().iso().allow(null).optional(),
  reviewDueAt: Joi.date().iso().allow(null).optional(),
  ownerUserId: Joi.string().uuid().allow(null).optional(),
  ownerDepartmentId: Joi.string().uuid().allow(null).optional(),
  appliesToAllEmployees: Joi.boolean().optional(),
  metadata: Joi.object().optional(),
  changeSummary: Joi.string().max(1000).allow('', null).optional()
});

export const requestChangesSchema = Joi.object({
  comment: Joi.string().min(1).max(2000).trim().required()
});

export const schedulePolicySchema = Joi.object({
  effectiveFrom: Joi.date().iso().greater('now').required()
});

export const supersedePolicySchema = Joi.object({
  supersededByPolicyId: Joi.string().uuid().required()
});

export const updateAssignmentsSchema = Joi.object({
  assignments: Joi.array().items(
    Joi.object({
      subjectType: Joi.string().valid('COMPANY', 'DEPARTMENT', 'POSITION', 'ROLE', 'EMPLOYEE').required(),
      subjectId: Joi.string().max(255).default('ALL'),
      assignmentType: Joi.string().valid('INCLUDE', 'EXCLUDE').default('INCLUDE'),
      isRequired: Joi.boolean().default(true),
      requiresAcceptance: Joi.boolean().default(true),
      requiresSignature: Joi.boolean().default(false),
      dueAt: Joi.date().iso().allow(null).optional()
    })
  ).required()
});

export const acceptPolicySchema = Joi.object({
  acceptedContentHash: Joi.string().length(64).hex().optional()
});

export const signPolicySchema = Joi.object({
  signatureType: Joi.string().valid('typed_name', 'drawn_signature').required(),
  typedSignatureName: Joi.when('signatureType', {
    is: 'typed_name',
    then: Joi.string().min(2).max(255).trim().required(),
    otherwise: Joi.string().allow('', null).optional()
  }),
  signatureAttachmentId: Joi.when('signatureType', {
    is: 'drawn_signature',
    then: Joi.string().uuid().optional(),
    otherwise: Joi.string().allow(null).optional()
  }),
  signatureStrokeData: Joi.object().allow(null).optional(),
  acceptedContentHash: Joi.string().length(64).hex().optional()
});

export const createPublicShareSchema = Joi.object({
  expiresAt: Joi.date().iso().allow(null).optional()
});

export const listPoliciesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow('').optional(),
  categoryId: Joi.string().uuid().optional(),
  policyType: Joi.string().trim().optional(),
  status: Joi.string().valid('draft', 'in_review', 'changes_requested', 'approved', 'scheduled', 'published', 'superseded', 'archived').optional(),
  visibility: Joi.string().valid('company', 'department', 'private', 'public').optional(),
  confidentialityLevel: Joi.string().valid('normal', 'confidential', 'restricted').optional(),
  ownerUserId: Joi.string().uuid().optional(),
  effectiveFrom: Joi.date().iso().optional(),
  effectiveUntil: Joi.date().iso().optional(),
  reviewDueFrom: Joi.date().iso().optional(),
  reviewDueTo: Joi.date().iso().optional(),
  mine: Joi.boolean().optional(),
  requiresAcceptance: Joi.boolean().optional(),
  requiresSignature: Joi.boolean().optional(),
  includeArchived: Joi.boolean().optional(),
  sortBy: Joi.string().valid('title', 'createdAt', 'updatedAt', 'effectiveFrom', 'effectiveUntil', 'reviewDueAt', 'publishedAt', 'version').default('createdAt'),
  sortDirection: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC')
});

export const listAcceptancesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('pending', 'viewed', 'accepted', 'signed', 'overdue', 'revoked', 'superseded').optional(),
  departmentId: Joi.string().uuid().optional(),
  positionId: Joi.string().uuid().optional(),
  roleId: Joi.string().uuid().optional(),
  employeeId: Joi.string().uuid().optional(),
  dueFrom: Joi.date().iso().optional(),
  dueTo: Joi.date().iso().optional(),
  search: Joi.string().trim().allow('').optional()
});
