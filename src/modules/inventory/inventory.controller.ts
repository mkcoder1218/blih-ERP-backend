import type { Request, Response } from "express";
import { db } from "../../models";
import { errorResponse, successResponse } from "../../utils/response";

export class InventoryController {
  list = async (req: Request, res: Response) => {
    try {
      const where: any = { businessId: req.user!.businessId };
      if (req.query.status) where.status = req.query.status;
      const items = await db.InventoryItem.findAll({ where, order: [["createdAt", "DESC"]] });
      successResponse(res, items, "Inventory fetched");
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const item = await db.InventoryItem.create({
        businessId: req.user!.businessId,
        name: req.body.name,
        category: req.body.category || "equipment",
        assetTag: req.body.assetTag || null,
        serialNumber: req.body.serialNumber || null,
        condition: req.body.condition || "New",
        status: req.body.status || "AVAILABLE",
        notes: req.body.notes || null,
        metadata: req.body.metadata || {},
      });
      successResponse(res, item, "Inventory item created", 201);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const item = await db.InventoryItem.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
      if (!item) return errorResponse(res, "Inventory item not found", 404);
      await item.update({
        name: req.body.name ?? item.name,
        category: req.body.category ?? item.category,
        assetTag: req.body.assetTag ?? item.assetTag,
        serialNumber: req.body.serialNumber ?? item.serialNumber,
        condition: req.body.condition ?? item.condition,
        status: req.body.status ?? item.status,
        notes: req.body.notes ?? item.notes,
        metadata: req.body.metadata ?? item.metadata,
      });
      successResponse(res, item, "Inventory item updated");
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      const item = await db.InventoryItem.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
      if (!item) return errorResponse(res, "Inventory item not found", 404);
      await item.update({ status: "RETIRED" });
      await item.destroy();
      successResponse(res, null, "Inventory item archived");
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };
}
