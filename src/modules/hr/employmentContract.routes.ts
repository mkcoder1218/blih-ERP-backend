import {
  Router,
} from "express";

import {
  authRequired,
} from "../../middlewares/auth";

import {
  requireRole,
} from "../../middlewares/role";

import {
  validate,
} from "../../middlewares/validate";

import {
  asyncHandler,
} from "../../utils/asyncHandler";

import {
  employmentContractAssignSchema,
  employmentContractCreateSchema,
  employmentContractFromOfferSchema,
  employmentContractListQuerySchema,
  employmentContractPreviewSchema,
  employmentContractTemplateCreateSchema,
  employmentContractTemplateUpdateSchema,
  employmentContractUpdateSchema,
} from "../../validators/employmentContract.validator";

import {
  EmploymentContractController,
} from "./employmentContract.controller";

import {
  EmploymentContractAssignmentController,
} from "./employmentContractAssignment.controller";

import {
  EmploymentContractEmployeeController,
} from "./employmentContractEmployee.controller";

import {
  EmploymentContractEmployerController,
} from "./employmentContractEmployer.controller";

const router =
  Router();

const controller =
  new EmploymentContractController();

const assignmentController =
  new EmploymentContractAssignmentController();

const employeeController =
  new EmploymentContractEmployeeController();

const employerController =
  new EmploymentContractEmployerController();

router.use(
  authRequired,
);

/**
 * Logged-in employee contract gate.
 */

router.get(
  "/me/pending",

  asyncHandler(
    employeeController.getPendingContract,
  ),
);

router.post(
  "/:id/sign-employee",

  asyncHandler(
    employeeController.signContract,
  ),
);

/**
 * Employer / manager countersignature.
 */

router.post(
  "/:id/sign-employer",

  requireRole(
    "HR_MANAGER",
    "BUSINESS_ADMIN",
  ),

  asyncHandler(
    employerController.signContract,
  ),
);

/**
 * Contract statuses.
 */

router.get(
  "/statuses",

  requireRole(
    "HR_MANAGER",
    "BUSINESS_ADMIN",
  ),

  asyncHandler(
    controller.getStatuses,
  ),
);

/**
 * Contract templates.
 */

router.get(
  "/templates",

  requireRole(
    "HR_MANAGER",
    "BUSINESS_ADMIN",
  ),

  asyncHandler(
    controller.getTemplates,
  ),
);

router.post(
  "/templates",

  requireRole(
    "HR_MANAGER",
    "BUSINESS_ADMIN",
  ),

  validate(
    employmentContractTemplateCreateSchema,
  ),

  asyncHandler(
    controller.createTemplate,
  ),
);

router.patch(
  "/templates/:id",

  requireRole(
    "HR_MANAGER",
    "BUSINESS_ADMIN",
  ),

  validate(
    employmentContractTemplateUpdateSchema,
  ),

  asyncHandler(
    controller.updateTemplate,
  ),
);

router.delete(
  "/templates/:id",

  requireRole(
    "HR_MANAGER",
    "BUSINESS_ADMIN",
  ),

  asyncHandler(
    controller.deleteTemplate,
  ),
);

/**
 * Assign contracts to employees.
 */

router.get(
  "/employee/:employeeRecordId/prefill",

  requireRole(
    "HR_MANAGER",
    "BUSINESS_ADMIN",
  ),

  asyncHandler(
    assignmentController.getEmployeePrefill,
  ),
);

router.post(
  "/employee/:employeeRecordId/assign",

  requireRole(
    "HR_MANAGER",
    "BUSINESS_ADMIN",
  ),

  validate(
    employmentContractAssignSchema,
  ),

  asyncHandler(
    assignmentController.assignContract,
  ),
);

/**
 * Unsaved contract preview.
 */

router.post(
  "/preview",

  requireRole(
    "HR_MANAGER",
    "BUSINESS_ADMIN",
  ),

  validate(
    employmentContractPreviewSchema,
  ),

  asyncHandler(
    controller.previewContract,
  ),
);

/**
 * Create contract from an accepted offer.
 */

router.post(
  "/from-offer/:offerId",

  requireRole(
    "HR_MANAGER",
    "BUSINESS_ADMIN",
  ),

  validate(
    employmentContractFromOfferSchema,
  ),

  asyncHandler(
    controller.createFromOffer,
  ),
);

/**
 * Contract CRUD.
 */

router.get(
  "/",

  requireRole(
    "HR_MANAGER",
    "BUSINESS_ADMIN",
  ),

  validate(
    employmentContractListQuerySchema,
    "query",
  ),

  asyncHandler(
    controller.getContracts,
  ),
);

router.post(
  "/",

  requireRole(
    "HR_MANAGER",
    "BUSINESS_ADMIN",
  ),

  validate(
    employmentContractCreateSchema,
  ),

  asyncHandler(
    controller.createContract,
  ),
);

router.get(
  "/:id",

  requireRole(
    "HR_MANAGER",
    "BUSINESS_ADMIN",
  ),

  asyncHandler(
    controller.getContract,
  ),
);

router.patch(
  "/:id",

  requireRole(
    "HR_MANAGER",
    "BUSINESS_ADMIN",
  ),

  validate(
    employmentContractUpdateSchema,
  ),

  asyncHandler(
    controller.updateContract,
  ),
);

router.delete(
  "/:id",

  requireRole(
    "HR_MANAGER",
    "BUSINESS_ADMIN",
  ),

  asyncHandler(
    controller.deleteContract,
  ),
);

router.post(
  "/:id/preview",

  requireRole(
    "HR_MANAGER",
    "BUSINESS_ADMIN",
  ),

  asyncHandler(
    controller.previewSavedContract,
  ),
);

export const employmentContractRoutes =
  router;
