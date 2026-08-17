import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { Router } from "express";
import Joi from "joi";
import multer from "multer";
import { validate } from "../../../middlewares/validate";
import { AuditLogService } from "../../../services/auditLog.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { successResponse } from "../../../utils/response";
import { BEHAVIOR_COLORS, BRAIN_CONTACT_OPTION_TYPES } from "./contactOption.model";
import { BrainContactsService } from "./contact.service";

const router = Router();
const service = new BrainContactsService();

const nullableUuid = Joi.string().uuid().allow(null, "").optional();
const phoneSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  number: Joi.string().trim().min(3).max(50).required(),
  label: Joi.string().trim().max(40).allow("", null).optional(),
});
const platformAccountSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  platformOptionId: Joi.string().uuid().required(),
  handle: Joi.string().trim().max(255).allow("", null).optional(),
  profileUrl: Joi.string().trim().uri().max(1000).allow("", null).optional(),
  followerCount: Joi.number().integer().min(0).allow(null).optional(),
});

const contactFields = {
  kind: Joi.string().valid("client", "influencer"),
  name: Joi.string().trim().min(2).max(255),
  phones: Joi.array().items(phoneSchema).min(1).max(20),
  email: Joi.string().trim().email().max(255).allow("", null),
  fieldOptionId: nullableUuid,
  behaviorOptionId: nullableUuid,
  companyOptionId: nullableUuid,
  positionOptionId: nullableUuid,
  clientTypeOptionId: nullableUuid,
  clientStatusOptionId: nullableUuid,
  location: Joi.string().trim().max(255).allow("", null),
  notes: Joi.string().trim().max(5000).allow("", null),
  profileImageUrl: Joi.string().trim().max(2000).allow("", null),
  platformAccounts: Joi.array().items(platformAccountSchema).max(20).default([]),
};

const createContactSchema = Joi.object({
  ...contactFields,
  kind: contactFields.kind.required(),
  name: contactFields.name.required(),
  phones: contactFields.phones.required(),
});

const updateContactSchema = Joi.object(contactFields).min(1);

const listContactsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(255).allow("").optional(),
  kind: Joi.string().valid("client", "influencer").optional(),
  fieldOptionId: Joi.string().uuid().optional(),
  behaviorOptionId: Joi.string().uuid().optional(),
  clientStatusOptionId: Joi.string().uuid().optional(),
});

const idParamSchema = Joi.object({ id: Joi.string().uuid().required() });
const optionTypeSchema = Joi.string().valid(...BRAIN_CONTACT_OPTION_TYPES);
const listOptionsQuerySchema = Joi.object({ type: optionTypeSchema.optional() });
const createOptionSchema = Joi.object({
  type: optionTypeSchema.required(),
  label: Joi.string().trim().min(1).max(120).required(),
  color: Joi.string().valid(...BEHAVIOR_COLORS).allow(null, "").optional(),
});
const updateOptionSchema = Joi.object({
  label: Joi.string().trim().min(1).max(120).optional(),
  color: Joi.string().valid(...BEHAVIOR_COLORS).allow(null, "").optional(),
}).min(1);

const uploadDirectory = path.join(process.cwd(), "uploads", "brain-contacts");
fs.mkdirSync(uploadDirectory, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      callback(null, `${Date.now()}-${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowed.has(file.mimetype)) {
      return callback(new Error("Profile image must be PNG, JPG, JPEG, or WebP"));
    }
    callback(null, true);
  },
});

router.get(
  "/",
  validate(listContactsQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const result = await service.listContacts(req.user!.businessId, req.query, req.user!.id);
    successResponse(res, result, "Contacts fetched successfully");
  }),
);

router.get(
  "/options",
  validate(listOptionsQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const rows = await service.listOptions(
      req.user!.businessId,
      req.query.type as any,
      req.user!.id,
    );
    successResponse(res, { rows }, "Contact options fetched successfully");
  }),
);

router.post(
  "/options",
  validate(createOptionSchema, "body"),
  asyncHandler(async (req, res) => {
    const option = await service.createOption(req.user!.businessId, req.user!.id, req.body);
    await AuditLogService.log("CREATE_BRAIN_CONTACT_OPTION", "brain_contact_option", String(option.id), null, option, req);
    successResponse(res, { option }, "Contact option created successfully", 201);
  }),
);

router.patch(
  "/options/:id",
  validate(idParamSchema, "params"),
  validate(updateOptionSchema, "body"),
  asyncHandler(async (req, res) => {
    const option = await service.updateOption(req.user!.businessId, req.params.id, req.body);
    await AuditLogService.log("UPDATE_BRAIN_CONTACT_OPTION", "brain_contact_option", req.params.id, null, option, req);
    successResponse(res, { option }, "Contact option updated successfully");
  }),
);

router.delete(
  "/options/:id",
  validate(idParamSchema, "params"),
  asyncHandler(async (req, res) => {
    await service.deleteOption(req.user!.businessId, req.params.id);
    await AuditLogService.log("DELETE_BRAIN_CONTACT_OPTION", "brain_contact_option", req.params.id, null, null, req);
    successResponse(res, {}, "Contact option removed successfully");
  }),
);

router.post(
  "/profile-image",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      const error: any = new Error("Profile image is required");
      error.statusCode = 400;
      throw error;
    }
    const imagePath = `/uploads/brain-contacts/${req.file.filename}`;
    successResponse(res, { imagePath }, "Profile image uploaded successfully", 201);
  }),
);

router.post(
  "/",
  validate(createContactSchema, "body"),
  asyncHandler(async (req, res) => {
    const contact = await service.createContact(req.user!.businessId, req.user!.id, req.body);
    await AuditLogService.log("CREATE_BRAIN_CONTACT", "crm_client", String(contact.id), null, contact, req);
    successResponse(res, { contact }, "Contact created successfully", 201);
  }),
);

router.get(
  "/:id",
  validate(idParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const contact = await service.getContact(req.user!.businessId, req.params.id);
    successResponse(res, { contact }, "Contact fetched successfully");
  }),
);

router.patch(
  "/:id",
  validate(idParamSchema, "params"),
  validate(updateContactSchema, "body"),
  asyncHandler(async (req, res) => {
    const contact = await service.updateContact(req.user!.businessId, req.user!.id, req.params.id, req.body);
    await AuditLogService.log("UPDATE_BRAIN_CONTACT", "crm_client", req.params.id, null, contact, req);
    successResponse(res, { contact }, "Contact updated successfully");
  }),
);

router.delete(
  "/:id",
  validate(idParamSchema, "params"),
  asyncHandler(async (req, res) => {
    await service.deleteContact(req.user!.businessId, req.params.id);
    await AuditLogService.log("DELETE_BRAIN_CONTACT", "crm_client", req.params.id, null, null, req);
    successResponse(res, {}, "Contact removed successfully");
  }),
);

export const brainContactRoutes = router;
