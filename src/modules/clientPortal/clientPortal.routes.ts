import { Router } from "express";
import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { asyncHandler } from "../../utils/asyncHandler";
import { ClientPortalController } from "./clientPortal.controller";
import { db } from "../../models";

const router = Router();
const controller = new ClientPortalController();

/**
 * Internal endpoints used to configure client portal access.
 */
router.post(
  "/users",
  authRequired,
  requireRole(
    "ACCOUNT_MANAGER",
    "BUSINESS_ADMIN",
  ),
  asyncHandler(controller.createPortalUser),
);

router.post(
  "/access",
  authRequired,
  requireRole(
    "ACCOUNT_MANAGER",
    "BUSINESS_ADMIN",
  ),
  asyncHandler(controller.createPortalAccess),
);

/**
 * Verifies that the authenticated ERP user is connected to an active
 * client portal user record.
 */
const requirePortalUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authenticatedUser = req.user;

    if (!authenticatedUser) {
      res.status(401).json({
        message: "Authentication is required.",
      });
      return;
    }

    const portalUser =
      await db.ClientPortalUser.findOne({
        where: {
          userId: authenticatedUser.id,
          businessId:
            authenticatedUser.businessId,
          status: "active",
        },
      });

    if (!portalUser) {
      res.status(403).json({
        message:
          "Access denied: not a designated client portal user.",
      });
      return;
    }

    req.portalUser = portalUser;
    next();
  } catch (error) {
    next(error);
  }
};

router.get(
  "/my-projects",
  authRequired,
  requirePortalUser,
  asyncHandler(controller.getClientProjects),
);

router.get(
  "/my-invoices",
  authRequired,
  requirePortalUser,
  asyncHandler(controller.getClientInvoices),
);

router.post(
  "/my-requests",
  authRequired,
  requirePortalUser,
  asyncHandler(controller.submitRequest),
);

router.post(
  "/my-feedbacks",
  authRequired,
  requirePortalUser,
  asyncHandler(controller.submitFeedback),
);

export const clientPortalRoutes = router;
