import { Router, type NextFunction, type Request, type Response } from "express";
import Joi from "joi";
import { validate } from "../../middlewares/validate";
import { requireActiveModule } from "../../middlewares/module";
import { requirePermission } from "../../middlewares/permission";
import { AuditLogService } from "../../services/auditLog.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { successResponse } from "../../utils/response";
import { BrainClientsService } from "./brain.clients.service";
import { brainContactRoutes } from "./contacts/contact.routes";

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

function requireClientDirectoryRole(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return next({ statusCode: 401, message: "Unauthorized" });
  }

  const roles = new Set(req.user.roles || []);
  const allowed = roles.has("BUSINESS_ADMIN") || roles.has("PROJECT_MANAGER");

  if (!allowed) {
    return next({
      statusCode: 403,
      message: "Client directory access is limited to Business Admin and Project Manager",
    });
  }

  next();
}

/**
 * Rich Brain contact directory.
 *
 * It deliberately lives beside the legacy client endpoint so existing Project
 * Manager consumers keep their old contract. Anyone with the Brain module and
 * brain.access can use Clients | Influencers, create options, edit, and remove.
 */
router.use(
  "/directory",
  requireActiveModule("brain"),
  requirePermission("brain.access"),
  brainContactRoutes,
);

// Legacy shared Client endpoint used by Project Manager and existing CRM flows.
// Keep its historical access rule and response contract intact.
router.use(requireClientDirectoryRole);

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
