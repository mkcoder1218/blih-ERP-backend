import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireActiveModule } from "../../middlewares/requireActiveModule";
import { requireAnyPermission } from "../../middlewares/permission";
import { requireRole } from "../../middlewares/role";
import { asyncHandler } from "../../utils/asyncHandler";
import { ProjectTelegramController } from "./projectTelegram.controller";

const router = Router();
const controller = new ProjectTelegramController();

router.use(requireActiveModule("projects"));
router.use(authRequired);

router.get("/settings", requireRole("BUSINESS_ADMIN"), asyncHandler(controller.getSettings));
router.put("/settings/bot", requireRole("BUSINESS_ADMIN"), asyncHandler(controller.upsertBotSetting));
router.put(
  "/settings/departments/:departmentId([0-9a-fA-F-]{36})",
  requireRole("BUSINESS_ADMIN"),
  asyncHandler(controller.upsertDepartment),
);
router.post("/test-connection", requireRole("BUSINESS_ADMIN"), asyncHandler(controller.testConnection));
router.post("/test-message", requireRole("BUSINESS_ADMIN"), asyncHandler(controller.sendTestMessage));
router.post(
  "/send-today",
  requireAnyPermission("project.task", "project.manage"),
  asyncHandler(controller.sendTodayTasks),
);

export const projectTelegramRoutes = router;
