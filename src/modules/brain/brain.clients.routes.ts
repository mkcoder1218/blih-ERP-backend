import { Router } from "express";
import Joi from "joi";
import { requireRole } from "../../middlewares/role";
import { validate } from "../../middlewares/validate";
import { AuditLogService } from "../../services/auditLog.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { successResponse } from "../../utils/response";
import { BrainClientsService } from "./brain.clients.service";

const router = Router();
const service = new BrainClientsService();

const listClientsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(255).allow("").optional(),
  status: Joi.string().valid("active", "inactive").optional(),
});

const createClientSchema = Joi.object({
  companyName: Joi.string().trim().min(2).max(255).required(),
  contactName: Joi.string().trim().max(255).allow("", null).optional(),
  email: Joi.string().trim().email().max(255).allow("", null).optional(),
  phone: Joi.string().trim().max(50).allow("", null).optional(),
  industry: Joi.string().trim().max(120).allow("", null).optional(),
  status: Joi.string().valid("active", "inactive").default("active"),
});

// Client directory is intentionally role-scoped rather than permission-scoped.
// Only Business Admin and Project Manager users may enumerate or create clients.
router.use(requireRole("BUSINESS_ADMIN", "PROJECT_MANAGER"));

router.get(
  "/",
  validate(listClientsQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const result = await service.listClients(req.user!.businessId, req.query);
    successResponse(res, result, "Clients fetched successfully");
  }),
);

router.post(
  "/",
  validate(createClientSchema, "body"),
  asyncHandler(async (req, res) => {
    const client = await service.createClient(
      req.user!.businessId,
      req.user!.id,
      req.body,
    );

    await AuditLogService.log(
      "CREATE_CLIENT",
      "crm_client",
      String(client.id),
      null,
      client,
      req,
    );

    successResponse(res, { client }, "Client created successfully", 201);
  }),
);

export const brainClientRoutes = router;
