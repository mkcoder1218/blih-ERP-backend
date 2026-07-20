import type {
    Request,
    Response,
} from "express";

import { db } from "../../../models";
import {
    errorResponse,
    successResponse,
} from "../../../utils/response";

const ACTIVE_EXIT_STATUSES = [
  "in_progress",
  "clearance_pending",
  "interview_scheduled",
  "interview_completed",
  "completed",
  "account_disabled",
];

export class ExitResourceController {
  list = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const exitProcess =
        await db.ExitProcess.findOne({
          where: {
            id: req.params.id,
            businessId:
              req.user!.businessId,
          },
        });

      if (!exitProcess) {
        return errorResponse(
          res,
          "Exit process not found.",
          404,
        );
      }

      const items =
        await db.InventoryItem.findAll({
          where: {
            businessId:
              req.user!.businessId,

            assignedToUserId:
              exitProcess.employeeUserId,
          },

          order: [
            ["updatedAt", "DESC"],
          ],
        });

      const acceptedItems =
        items.filter((item: any) => {
          const metadata =
            item.metadata || {};

          const acceptanceStatus =
            String(
              metadata.acceptanceStatus ||
                metadata.employeeAcceptanceStatus ||
                "",
            ).toLowerCase();

          return Boolean(
            metadata.acceptedAt ||
              metadata.employeeAcceptedAt ||
              [
                "accepted",
                "received",
                "confirmed",
                "employee_accepted",
              ].includes(
                acceptanceStatus,
              ),
          );
        });

      successResponse(
        res,
        acceptedItems,
        "Accepted resources fetched.",
      );
    } catch (error: any) {
      errorResponse(
        res,
        error.message,
      );
    }
  };

  register = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const exitProcess =
        await db.ExitProcess.findOne({
          where: {
            id: req.params.id,
            businessId:
              req.user!.businessId,
          },
        });

      if (!exitProcess) {
        return errorResponse(
          res,
          "Exit process not found.",
          404,
        );
      }

      if (
        !ACTIVE_EXIT_STATUSES.includes(
          String(exitProcess.status),
        )
      ) {
        return errorResponse(
          res,
          "Resources can only be registered after exit approval.",
          400,
        );
      }

      const inventoryItemId =
        String(
          req.body.inventoryItemId ||
            "",
        ).trim();

      if (!inventoryItemId) {
        return errorResponse(
          res,
          "inventoryItemId is required.",
          400,
        );
      }

      const item =
        await db.InventoryItem.findOne({
          where: {
            id: inventoryItemId,
            businessId:
              req.user!.businessId,
          },
        });

      if (!item) {
        return errorResponse(
          res,
          "Inventory item not found.",
          404,
        );
      }

      if (
        item.assignedToUserId &&
        String(item.assignedToUserId) !==
          String(
            exitProcess.employeeUserId,
          )
      ) {
        return errorResponse(
          res,
          "This resource is assigned to another employee.",
          400,
        );
      }

      const now =
        new Date().toISOString();

      const metadata = {
        ...(item.metadata || {}),

        acceptanceStatus:
          "accepted",

        acceptedAt:
          item.metadata?.acceptedAt ||
          now,

        acceptedByUserId:
          exitProcess.employeeUserId,

        registeredForExitAt:
          now,

        registeredForExitByUserId:
          req.user!.id,

        returnStatus:
          item.metadata?.returnStatus ||
          "pending",
      };

      await item.update({
        assignedToUserId:
          exitProcess.employeeUserId,

        status: "ASSIGNED",

        metadata,
      });

      successResponse(
        res,
        item,
        "Accepted resource registered.",
      );
    } catch (error: any) {
      errorResponse(
        res,
        error.message,
        400,
      );
    }
  };

  updateReturn = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const exitProcess =
        await db.ExitProcess.findOne({
          where: {
            id: req.params.id,
            businessId:
              req.user!.businessId,
          },
        });

      if (!exitProcess) {
        return errorResponse(
          res,
          "Exit process not found.",
          404,
        );
      }

      const item =
        await db.InventoryItem.findOne({
          where: {
            id: req.params.resourceId,

            businessId:
              req.user!.businessId,

            assignedToUserId:
              exitProcess.employeeUserId,
          },
        });

      if (!item) {
        return errorResponse(
          res,
          "Employee resource not found.",
          404,
        );
      }

      const returnStatus =
        String(
          req.body.returnStatus ||
            "",
        ).trim();

      if (
        ![
          "pending",
          "returned",
          "damaged",
          "lost",
          "waived",
        ].includes(returnStatus)
      ) {
        return errorResponse(
          res,
          "Invalid resource return status.",
          400,
        );
      }

      const metadata = {
        ...(item.metadata || {}),

        returnStatus,

        returnCondition:
          req.body.returnCondition ??
          item.metadata
            ?.returnCondition ??
          null,

        returnNotes:
          req.body.returnNotes ??
          item.metadata?.returnNotes ??
          null,

        deductionAmount:
          req.body.deductionAmount !==
          undefined
            ? Number(
                req.body
                  .deductionAmount,
              )
            : item.metadata
                ?.deductionAmount ??
              0,

        returnedAt:
          returnStatus === "returned"
            ? new Date().toISOString()
            : null,

        returnedToUserId:
          [
            "returned",
            "damaged",
            "lost",
            "waived",
          ].includes(returnStatus)
            ? req.user!.id
            : null,
      };

      await item.update({
        metadata,

        status:
          returnStatus === "returned"
            ? "AVAILABLE"
            : item.status,

        assignedToUserId:
          returnStatus === "returned"
            ? null
            : item.assignedToUserId,
      });

      successResponse(
        res,
        item,
        "Resource return updated.",
      );
    } catch (error: any) {
      errorResponse(
        res,
        error.message,
        400,
      );
    }
  };
}