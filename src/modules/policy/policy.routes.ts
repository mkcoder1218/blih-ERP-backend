import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requirePermission, requireAnyPermission } from "../../middlewares/permission";
import { requireActiveModule } from "../../middlewares/module";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { PolicyController } from "./policy.controller";
import {
  categoryIdParamSchema,
  policyIdParamSchema,
  versionIdParamSchema,
  createCategorySchema,
  updateCategorySchema,
  listCategoriesQuerySchema,
  createPolicySchema,
  updatePolicySchema,
  requestChangesSchema,
  schedulePolicySchema,
  supersedePolicySchema,
  updateAssignmentsSchema,
  acceptPolicySchema,
  signPolicySchema,
  createPublicShareSchema,
  listPoliciesQuerySchema,
  listAcceptancesQuerySchema
} from "./policy.validation";

const router = Router();
const controller = new PolicyController();

// Global guards for all policy routes
router.use(authRequired);
router.use(requireActiveModule("policy"));
router.use(requirePermission("policy.access"));

// ── Categories ──────────────────────────────────────────────────────────

router.post(
  "/categories",
  requirePermission("policy.category.create"),
  validate(createCategorySchema, "body"),
  asyncHandler(controller.createCategory)
);

router.get(
  "/categories",
  requirePermission("policy.category.view"),
  validate(listCategoriesQuerySchema, "query"),
  asyncHandler(controller.listCategories)
);

router.get(
  "/categories/:id",
  requirePermission("policy.category.view"),
  validate(categoryIdParamSchema, "params"),
  asyncHandler(controller.getCategory)
);

router.patch(
  "/categories/:id",
  requirePermission("policy.category.update"),
  validate(categoryIdParamSchema, "params"),
  validate(updateCategorySchema, "body"),
  asyncHandler(controller.updateCategory)
);

router.delete(
  "/categories/:id",
  requirePermission("policy.category.delete"),
  validate(categoryIdParamSchema, "params"),
  asyncHandler(controller.deleteCategory)
);

router.patch(
  "/categories/:id/restore",
  requirePermission("policy.category.restore"),
  validate(categoryIdParamSchema, "params"),
  asyncHandler(controller.restoreCategory)
);

// ── Acceptance Obligations (User Self-Service) ─────────────────────────

router.get(
  "/my-required",
  requirePermission("policy.acceptance.view_own"),
  asyncHandler(controller.getMyRequiredPolicies)
);

router.get(
  "/my-acceptances",
  requirePermission("policy.acceptance.view_own"),
  asyncHandler(controller.getMyAcceptances)
);

router.get(
  "/acceptances",
  requireAnyPermission("policy.acceptance.view_all", "policy.acceptance.view_team"),
  validate(listAcceptancesQuerySchema, "query"),
  asyncHandler(controller.listAcceptances)
);

// ── Policy Document CRUD ────────────────────────────────────────────────

router.post(
  "/",
  requirePermission("policy.document.create"),
  validate(createPolicySchema, "body"),
  asyncHandler(controller.createPolicy)
);

router.get(
  "/",
  requirePermission("policy.document.view"),
  validate(listPoliciesQuerySchema, "query"),
  asyncHandler(controller.listPolicies)
);

router.get(
  "/:id",
  requirePermission("policy.document.view"),
  validate(policyIdParamSchema, "params"),
  asyncHandler(controller.getPolicy)
);

router.patch(
  "/:id",
  requireAnyPermission("policy.document.update_own", "policy.document.update_any"),
  validate(policyIdParamSchema, "params"),
  validate(updatePolicySchema, "body"),
  asyncHandler(controller.updatePolicy)
);

router.delete(
  "/:id",
  requirePermission("policy.document.delete"),
  validate(policyIdParamSchema, "params"),
  asyncHandler(controller.deletePolicy)
);

router.patch(
  "/:id/restore",
  requirePermission("policy.document.restore"),
  validate(policyIdParamSchema, "params"),
  asyncHandler(controller.restorePolicy)
);

// ── Workflow Transitions ──────────────────────────────────────────────────

router.post(
  "/:id/submit-review",
  requirePermission("policy.document.submit_review"),
  validate(policyIdParamSchema, "params"),
  asyncHandler(controller.submitForReview)
);

router.post(
  "/:id/request-changes",
  requirePermission("policy.document.review"),
  validate(policyIdParamSchema, "params"),
  validate(requestChangesSchema, "body"),
  asyncHandler(controller.requestChanges)
);

router.post(
  "/:id/approve",
  requirePermission("policy.document.approve"),
  validate(policyIdParamSchema, "params"),
  asyncHandler(controller.approvePolicy)
);

router.post(
  "/:id/schedule",
  requirePermission("policy.document.schedule"),
  validate(policyIdParamSchema, "params"),
  validate(schedulePolicySchema, "body"),
  asyncHandler(controller.schedulePolicy)
);

router.post(
  "/:id/publish",
  requirePermission("policy.document.publish"),
  validate(policyIdParamSchema, "params"),
  asyncHandler(controller.publishPolicy)
);

router.post(
  "/:id/unpublish",
  requirePermission("policy.document.publish"),
  validate(policyIdParamSchema, "params"),
  asyncHandler(controller.unpublishPolicy)
);

router.post(
  "/:id/supersede",
  requirePermission("policy.document.supersede"),
  validate(policyIdParamSchema, "params"),
  validate(supersedePolicySchema, "body"),
  asyncHandler(controller.supersedePolicy)
);

router.post(
  "/:id/archive",
  requirePermission("policy.document.archive"),
  validate(policyIdParamSchema, "params"),
  asyncHandler(controller.archivePolicy)
);

// ── Versions ─────────────────────────────────────────────────────────────

router.get(
  "/:id/versions",
  requirePermission("policy.document.view_versions"),
  validate(policyIdParamSchema, "params"),
  asyncHandler(controller.listVersions)
);

router.get(
  "/:id/versions/:versionId",
  requirePermission("policy.document.view_versions"),
  validate(versionIdParamSchema, "params"),
  asyncHandler(controller.getVersion)
);

router.post(
  "/:id/versions/:versionId/restore",
  requirePermission("policy.document.restore_version"),
  validate(versionIdParamSchema, "params"),
  asyncHandler(controller.restoreVersion)
);

// ── Assignments ──────────────────────────────────────────────────────────

router.get(
  "/:id/assignments",
  requirePermission("policy.assignment.view"),
  validate(policyIdParamSchema, "params"),
  asyncHandler(controller.listAssignments)
);

router.put(
  "/:id/assignments",
  requirePermission("policy.assignment.manage"),
  validate(policyIdParamSchema, "params"),
  validate(updateAssignmentsSchema, "body"),
  asyncHandler(controller.updateAssignments)
);

// ── Acceptance Actions ───────────────────────────────────────────────────

router.post(
  "/:id/accept",
  requirePermission("policy.acceptance.accept"),
  validate(policyIdParamSchema, "params"),
  validate(acceptPolicySchema, "body"),
  asyncHandler(controller.acceptPolicy)
);

router.post(
  "/:id/sign",
  requirePermission("policy.acceptance.sign"),
  validate(policyIdParamSchema, "params"),
  validate(signPolicySchema, "body"),
  asyncHandler(controller.signPolicy)
);

router.get(
  "/:id/acceptance-summary",
  requireAnyPermission("policy.acceptance.view_all", "policy.acceptance.view_team"),
  validate(policyIdParamSchema, "params"),
  asyncHandler(controller.getAcceptanceSummary)
);

router.get(
  "/:id/acceptances/export",
  requirePermission("policy.acceptance.export"),
  validate(policyIdParamSchema, "params"),
  asyncHandler(controller.exportAcceptancesCSV)
);

// ── Public Sharing Administration ────────────────────────────────────────

router.post(
  "/:id/public-share",
  requirePermission("policy.public_share.manage"),
  validate(policyIdParamSchema, "params"),
  validate(createPublicShareSchema, "body"),
  asyncHandler(controller.createPublicShare)
);

router.delete(
  "/:id/public-share",
  requirePermission("policy.public_share.manage"),
  validate(policyIdParamSchema, "params"),
  asyncHandler(controller.revokePublicShare)
);

export const policyRoutes = router;
