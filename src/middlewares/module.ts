import type { Request, Response, NextFunction } from "express";
import { db } from "../models";

export const requireActiveModule = (moduleKey: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user?.businessId;
      if (!businessId) {
        return next({ statusCode: 401, message: "Unauthorized" });
      }

      const businessModule = await db.BusinessModule.findOne({
        where: { businessId, moduleKey, status: "active" }
      });

      if (!businessModule) {
        return next({
          statusCode: 403,
          message: `Module '${moduleKey}' is not active for this business.`
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
