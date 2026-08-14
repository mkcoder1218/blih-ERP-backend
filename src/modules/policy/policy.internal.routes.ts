import { Router } from "express";
import Joi from "joi";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { successResponse } from "../../utils/response";
import { PolicyInternalService } from "./policy.internal.service";

const router = Router();
const service = new PolicyInternalService();

const listInternalPoliciesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow("").optional(),
  categoryId: Joi.string().uuid().optional(),
  policyType: Joi.string().trim().max(120).optional(),
  sortBy: Joi.string().valid("title", "publishedAt", "effectiveFrom", "updatedAt").default("publishedAt"),
  sortDirection: Joi.string().valid("ASC", "DESC", "asc", "desc").default("DESC"),
});

const internalPolicyIdParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

router.get(
  "/",
  validate(listInternalPoliciesQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const result = await service.listPublishedCompanyPolicies(
      req.user!.businessId,
      req.query,
    );

    successResponse(res, result, "Company policy library fetched successfully");
  }),
);

router.get(
  "/:id",
  validate(internalPolicyIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const policy = await service.getPublishedCompanyPolicy(
      req.user!.businessId,
      req.params.id,
    );

    successResponse(res, { policy }, "Company policy fetched successfully");
  }),
);

export const internalPolicyRoutes = router;
