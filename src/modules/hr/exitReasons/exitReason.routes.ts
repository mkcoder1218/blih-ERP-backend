import { Router } from "express";
import { authRequired } from "../../../middlewares/auth";
import { requireAnyPermission } from "../../../middlewares/permission";
import { asyncHandler } from "../../../utils/asyncHandler";
import { ExitReasonController } from "./exitReason.controller";

const router = Router();
const controller =
  new ExitReasonController();

router.get(
  "/exit/reasons",
  authRequired,
  requireAnyPermission(
    "hr.read",
    "hr.write",
    "exit.self",
  ),
  asyncHandler(controller.list),
);

router.post(
  "/exit/reasons",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(controller.create),
);

router.patch(
  "/exit/reasons/reorder",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(controller.reorder),
);

router.patch(
  "/exit/reasons/:id",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(controller.update),
);

router.delete(
  "/exit/reasons/:id",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(controller.remove),
);

export default router;
