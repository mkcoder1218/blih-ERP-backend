import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireAnyPermission } from "../../middlewares/permission";
import { requireActiveModule } from "../../middlewares/requireActiveModule";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  initializeProbationSchema,
  listProbationsQuerySchema,
  replacePositionCompetenciesSchema,
  probationReviewSchema,
  probationFinalDecisionSchema,
} from "../../validators/probation.validator";
import { ProbationController } from "./probation.controller";

const router = Router();
const controller =
  new ProbationController();

router.use(
  requireActiveModule("hr"),
);

router.get(
  "/positions/:positionId/competencies",
  authRequired,
  requireAnyPermission(
    "performance.read",
    "performance.manage",
    "onboarding.read",
    "onboarding.manage",
    "hr.read",
    "hr.write",
  ),
  asyncHandler(
    controller.getPositionCompetencies,
  ),
);

router.put(
  "/positions/:positionId/competencies",
  authRequired,
  requireAnyPermission(
    "performance.manage",
    "onboarding.manage",
    "hr.write",
  ),
  validate(
    replacePositionCompetenciesSchema,
  ),
  asyncHandler(
    controller.replacePositionCompetencies,
  ),
);

router.post(
  "/initialize",
  authRequired,
  requireAnyPermission(
    "performance.manage",
    "onboarding.manage",
    "hr.write",
  ),
  validate(
    initializeProbationSchema,
  ),
  asyncHandler(
    controller.initialize,
  ),
);

router.get(
  "/",
  authRequired,
  requireAnyPermission(
    "performance.read",
    "performance.manage",
    "onboarding.read",
    "onboarding.manage",
    "hr.read",
    "hr.write",
  ),
  validate(
    listProbationsQuerySchema,
    "query",
  ),
  asyncHandler(controller.list),
);

router.get(
  "/mine/current",
  authRequired,
  asyncHandler(controller.getMine),
);

router.post(
  "/:probationId/manager-review",
  authRequired,
  requireAnyPermission("performance.manage", "hr.write"),
  validate(probationReviewSchema),
  asyncHandler(controller.submitManagerReview),
);

router.post(
  "/:probationId/hr-review",
  authRequired,
  requireAnyPermission("performance.manage", "hr.write"),
  validate(probationReviewSchema),
  asyncHandler(controller.submitHrReview),
);

router.post(
  "/:probationId/final-decision",
  authRequired,
  requireAnyPermission("performance.manage", "hr.write"),
  validate(probationFinalDecisionSchema),
  asyncHandler(controller.makeFinalDecision),
);

router.post(
  "/:probationId/acknowledge",
  authRequired,
  asyncHandler(controller.acknowledge),
);

router.get(
  "/:probationId",
  authRequired,
  requireAnyPermission(
    "performance.read",
    "performance.manage",
    "onboarding.read",
    "onboarding.manage",
    "hr.read",
    "hr.write",
  ),
  asyncHandler(controller.getById),
);

export const probationRoutes =
  router;
