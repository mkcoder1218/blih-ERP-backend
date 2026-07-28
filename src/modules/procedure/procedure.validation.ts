import Joi from 'joi';

export const createProcedureSchema = Joi.object({
  title: Joi.string().trim().max(500).required(),
  categoryId: Joi.string().uuid().allow(null).optional(),
  responsibleDepartmentId: Joi.string().uuid().allow(null).optional(),
  purpose: Joi.string().allow('', null).optional(),
  scope: Joi.string().allow('', null).optional(),
  responsibilities: Joi.string().allow('', null).optional(),
  prerequisites: Joi.string().allow('', null).optional(),
  steps: Joi.array().items(Joi.object({
    instruction: Joi.string().required(),
    expectedResult: Joi.string().allow('', null).optional()
  })).default([]),
  expectedResult: Joi.string().allow('', null).optional(),
  visibility: Joi.string().valid('company', 'department', 'private').default('company'),
  effectiveDate: Joi.date().iso().allow(null).optional(),
  reviewDueDate: Joi.date().iso().allow(null).optional(),
  metadata: Joi.object().optional()
});

export const updateProcedureSchema = Joi.object({
  title: Joi.string().trim().max(500).optional(),
  categoryId: Joi.string().uuid().allow(null).optional(),
  responsibleDepartmentId: Joi.string().uuid().allow(null).optional(),
  purpose: Joi.string().allow('', null).optional(),
  scope: Joi.string().allow('', null).optional(),
  responsibilities: Joi.string().allow('', null).optional(),
  prerequisites: Joi.string().allow('', null).optional(),
  steps: Joi.array().items(Joi.object({
    instruction: Joi.string().required(),
    expectedResult: Joi.string().allow('', null).optional()
  })).optional(),
  expectedResult: Joi.string().allow('', null).optional(),
  visibility: Joi.string().valid('company', 'department', 'private').optional(),
  effectiveDate: Joi.date().iso().allow(null).optional(),
  reviewDueDate: Joi.date().iso().allow(null).optional(),
  metadata: Joi.object().optional(),
  changeSummary: Joi.string().max(1000).allow('', null).optional()
}).min(1);

export const procedureIdParamSchema = Joi.object({
  id: Joi.string().uuid().required()
}).unknown(true);

export const revisionIdParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
  revisionId: Joi.string().uuid().required()
}).unknown(true);

export const reviewDecisionSchema = Joi.object({
  comment: Joi.string().trim().min(1).max(2000).required()
});

export const listProceduresQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().allow('', null).optional(),
  categoryId: Joi.string().uuid().allow('', null).optional(),
  status: Joi.string().valid('draft', 'in_review', 'changes_requested', 'approved', 'published', 'archived').optional(),
  visibility: Joi.string().valid('company', 'department', 'private').optional(),
  authorUserId: Joi.string().uuid().allow('', null).optional(),
  responsibleDepartmentId: Joi.string().uuid().allow('', null).optional(),
  mine: Joi.boolean().optional(),
  includeArchived: Joi.boolean().optional(),
  sortBy: Joi.string().valid('title', 'createdAt', 'updatedAt', 'effectiveDate', 'reviewDueDate', 'version').default('updatedAt'),
  sortDirection: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC')
});
