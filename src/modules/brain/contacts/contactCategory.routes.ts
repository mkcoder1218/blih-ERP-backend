import { Router } from "express";
import Joi from "joi";
import { requirePermission } from "../../../middlewares/permission";
import { validate } from "../../../middlewares/validate";
import { AuditLogService } from "../../../services/auditLog.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { successResponse } from "../../../utils/response";
import { BRAIN_CONTACT_FIELD_TYPES } from "./contactCategory.model";
import { BrainContactCategoryService } from "./contactCategory.service";

const router = Router();
const service = new BrainContactCategoryService();
const id = Joi.string().uuid().required();
const categoryParams = Joi.object({ categoryId: id });
const categoryFieldParams = Joi.object({ categoryId: id, fieldId: id });
const categoryContactParams = Joi.object({ categoryId: id, contactId: id });
const option = Joi.alternatives().try(
  Joi.string().trim().min(1).max(120),
  Joi.object({ id, label: Joi.string().trim().min(1).max(120).required() }),
);
const field = Joi.object({
  label: Joi.string().trim().min(1).max(120).required(),
  type: Joi.string().valid(...BRAIN_CONTACT_FIELD_TYPES).required(),
  isRequired: Joi.boolean().default(false),
  showInTable: Joi.boolean().default(false),
  options: Joi.array().items(option).max(100).default([]),
});

router.get(
  "/categories",
  requirePermission("brain.contact_categories.view"),
  validate(Joi.object({ includeArchived: Joi.boolean().default(false) }), "query"),
  asyncHandler(async (req, res) => {
    const rows = await service.listCategories(req.user!.businessId, String(req.query.includeArchived) === "true");
    successResponse(res, { rows }, "Contact categories fetched successfully");
  }),
);

router.post(
  "/categories",
  requirePermission("brain.contact_categories.create"),
  validate(Joi.object({
    name: Joi.string().trim().min(2).max(120).required(),
    iconName: Joi.string().trim().min(1).max(120).default("Users"),
    description: Joi.string().trim().max(500).allow("", null).optional(),
    fields: Joi.array().items(field).max(50).default([]),
  }), "body"),
  asyncHandler(async (req, res) => {
    const category = await service.createCategory(req.user!.businessId, req.user!.id, req.body);
    await AuditLogService.log("CREATE_BRAIN_CONTACT_CATEGORY", "brain_contact_category", String((category as any).id), null, category, req);
    successResponse(res, { category }, "Contact category created successfully", 201);
  }),
);

router.patch(
  "/categories/:categoryId",
  requirePermission("brain.contact_categories.update"),
  validate(categoryParams, "params"),
  validate(Joi.object({
    name: Joi.string().trim().min(2).max(120).optional(),
    iconName: Joi.string().trim().min(1).max(120).optional(),
    description: Joi.string().trim().max(500).allow("", null).optional(),
    isActive: Joi.boolean().optional(),
  }).min(1), "body"),
  asyncHandler(async (req, res) => {
    const category = await service.updateCategory(req.user!.businessId, req.user!.id, req.params.categoryId, req.body);
    await AuditLogService.log("UPDATE_BRAIN_CONTACT_CATEGORY", "brain_contact_category", req.params.categoryId, null, category, req);
    successResponse(res, { category }, "Contact category updated successfully");
  }),
);

router.delete(
  "/categories/:categoryId",
  requirePermission("brain.contact_categories.archive"),
  validate(categoryParams, "params"),
  asyncHandler(async (req, res) => {
    const category = await service.archiveCategory(req.user!.businessId, req.user!.id, req.params.categoryId);
    await AuditLogService.log("ARCHIVE_BRAIN_CONTACT_CATEGORY", "brain_contact_category", req.params.categoryId, null, category, req);
    successResponse(res, { category }, "Contact category archived successfully");
  }),
);

router.post(
  "/categories/:categoryId/fields",
  requirePermission("brain.contact_fields.create"),
  validate(categoryParams, "params"),
  validate(field, "body"),
  asyncHandler(async (req, res) => {
    const created = await service.createField(req.user!.businessId, req.user!.id, req.params.categoryId, req.body);
    successResponse(res, { field: created }, "Contact field created successfully", 201);
  }),
);

router.patch(
  "/categories/:categoryId/fields/:fieldId",
  requirePermission("brain.contact_fields.update"),
  validate(categoryFieldParams, "params"),
  validate(Joi.object({
    label: Joi.string().trim().min(1).max(120).optional(),
    type: Joi.string().valid(...BRAIN_CONTACT_FIELD_TYPES).optional(),
    isRequired: Joi.boolean().optional(),
    showInTable: Joi.boolean().optional(),
    isArchived: Joi.boolean().optional(),
    options: Joi.array().items(option).max(100).optional(),
  }).min(1), "body"),
  asyncHandler(async (req, res) => {
    const updated = await service.updateField(req.user!.businessId, req.user!.id, req.params.categoryId, req.params.fieldId, req.body);
    successResponse(res, { field: updated }, "Contact field updated successfully");
  }),
);

router.delete(
  "/categories/:categoryId/fields/:fieldId",
  requirePermission("brain.contact_fields.archive"),
  validate(categoryFieldParams, "params"),
  asyncHandler(async (req, res) => {
    const archived = await service.archiveField(req.user!.businessId, req.user!.id, req.params.categoryId, req.params.fieldId);
    successResponse(res, { field: archived }, "Contact field archived successfully");
  }),
);

router.patch(
  "/categories/:categoryId/fields-reorder",
  requirePermission("brain.contact_fields.reorder"),
  validate(categoryParams, "params"),
  validate(Joi.object({ orderedFieldIds: Joi.array().items(id).min(1).max(51).required() }), "body"),
  asyncHandler(async (req, res) => {
    const category = await service.reorderFields(req.user!.businessId, req.user!.id, req.params.categoryId, req.body.orderedFieldIds);
    successResponse(res, { category }, "Contact fields reordered successfully");
  }),
);

const contactInput = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  values: Joi.object().unknown(true).default({}),
});

router.get(
  "/categories/:categoryId/contacts",
  requirePermission("brain.contacts.view"),
  validate(categoryParams, "params"),
  validate(Joi.object({
    page: Joi.number().integer().min(1).default(1),
    size: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(255).allow("").optional(),
  }), "query"),
  asyncHandler(async (req, res) => {
    successResponse(res, await service.listCustomContacts(req.user!.businessId, req.params.categoryId, req.query), "Contacts fetched successfully");
  }),
);

router.post(
  "/categories/:categoryId/contacts",
  requirePermission("brain.contacts.create"),
  validate(categoryParams, "params"),
  validate(contactInput, "body"),
  asyncHandler(async (req, res) => {
    const contact = await service.createCustomContact(req.user!.businessId, req.user!.id, req.params.categoryId, req.body);
    await AuditLogService.log("CREATE_BRAIN_CUSTOM_CONTACT", "brain_custom_contact", String((contact as any).id), null, contact, req);
    successResponse(res, { contact }, "Contact created successfully", 201);
  }),
);

router.patch(
  "/categories/:categoryId/contacts/:contactId",
  requirePermission("brain.contacts.update"),
  validate(categoryContactParams, "params"),
  validate(contactInput, "body"),
  asyncHandler(async (req, res) => {
    const contact = await service.updateCustomContact(req.user!.businessId, req.user!.id, req.params.categoryId, req.params.contactId, req.body);
    await AuditLogService.log("UPDATE_BRAIN_CUSTOM_CONTACT", "brain_custom_contact", req.params.contactId, null, contact, req);
    successResponse(res, { contact }, "Contact updated successfully");
  }),
);

router.delete(
  "/categories/:categoryId/contacts/:contactId",
  requirePermission("brain.contacts.delete"),
  validate(categoryContactParams, "params"),
  asyncHandler(async (req, res) => {
    await service.deleteCustomContact(req.user!.businessId, req.params.categoryId, req.params.contactId);
    await AuditLogService.log("DELETE_BRAIN_CUSTOM_CONTACT", "brain_custom_contact", req.params.contactId, null, null, req);
    successResponse(res, {}, "Contact removed successfully");
  }),
);

router.get(
  "/categories/:categoryId/column-preferences",
  requirePermission("brain.contacts.view"),
  validate(categoryParams, "params"),
  asyncHandler(async (req, res) => {
    const preference = await service.getColumnPreference(req.user!.businessId, req.user!.id, req.params.categoryId);
    successResponse(res, { preference }, "Contact column preferences fetched successfully");
  }),
);

router.put(
  "/categories/:categoryId/column-preferences",
  requirePermission("brain.contacts.view"),
  validate(categoryParams, "params"),
  validate(Joi.object({ visibleFieldIds: Joi.array().items(id).max(51).required() }), "body"),
  asyncHandler(async (req, res) => {
    const preference = await service.updateColumnPreference(req.user!.businessId, req.user!.id, req.params.categoryId, req.body.visibleFieldIds);
    successResponse(res, { preference }, "Contact column preferences updated successfully");
  }),
);

export const brainContactCategoryRoutes = router;
