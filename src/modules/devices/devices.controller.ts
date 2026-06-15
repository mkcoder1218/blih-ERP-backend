import type { Request, Response, NextFunction } from "express";
import { db } from "../../models";
import { ok } from "../../utils/apiResponse";

const AUTO_APPROVED_DEVICE_LIMIT = 2;

function cleanDeviceKey(value: unknown) {
  return String(value || "").trim().slice(0, 120);
}

function cleanLabel(value: unknown) {
  const label = String(value || "").trim().slice(0, 160);
  return label || "My device";
}

function cleanUserAgent(value: unknown) {
  const userAgent = String(value || "").trim();
  return userAgent ? userAgent.slice(0, 1000) : null;
}

export class DevicesController {
  listMine = async (req: Request, res: Response) => {
    const devices = await db.TrustedDevice.findAll({
      where: { businessId: req.user!.businessId, userId: req.user!.id },
      order: [["createdAt", "ASC"]],
    });
    return ok(res, { devices }, "My devices");
  };

  seenMine = async (req: Request, res: Response) => {
    const deviceKey = cleanDeviceKey(req.body?.deviceKey);
    if (!deviceKey) return ok(res, { registered: false, device: null, mustRegister: true }, "Device not registered");

    const device = await db.TrustedDevice.findOne({
      where: { businessId: req.user!.businessId, userId: req.user!.id, deviceKey },
    });

    if (!device) return ok(res, { registered: false, device: null, mustRegister: true }, "Device not registered");

    await device.update({
      userAgent: cleanUserAgent(req.body?.userAgent) ?? device.userAgent,
      lastSeenAt: new Date(),
    });

    return ok(res, { registered: true, device, mustRegister: device.status !== "approved" }, "Device seen");
  };

  registerMine = async (req: Request, res: Response, next: NextFunction) => {
    const deviceKey = cleanDeviceKey(req.body?.deviceKey);
    if (!deviceKey) return next({ statusCode: 400, message: "Device key is required" });

    const payload = {
      label: cleanLabel(req.body?.label),
      userAgent: cleanUserAgent(req.body?.userAgent),
      lastSeenAt: new Date(),
    };

    const existing = await db.TrustedDevice.findOne({
      where: { businessId: req.user!.businessId, userId: req.user!.id, deviceKey },
    });

    if (existing) {
      const next: any = { ...payload };
      if (existing.status === "rejected") {
        const approvedCount = await db.TrustedDevice.count({
          where: { businessId: req.user!.businessId, userId: req.user!.id, status: "approved" },
        });
        next.status = approvedCount < AUTO_APPROVED_DEVICE_LIMIT ? "approved" : "pending";
        next.approvedAt = next.status === "approved" ? new Date() : null;
        next.approvedByUserId = next.status === "approved" ? req.user!.id : null;
        next.rejectedAt = null;
        next.rejectedByUserId = null;
      }
      await existing.update(next);
      return ok(res, { device: existing, requiresApproval: existing.status !== "approved" }, "Device registration updated");
    }

    const approvedCount = await db.TrustedDevice.count({
      where: { businessId: req.user!.businessId, userId: req.user!.id, status: "approved" },
    });
    const status = approvedCount < AUTO_APPROVED_DEVICE_LIMIT ? "approved" : "pending";

    const device = await db.TrustedDevice.create({
      businessId: req.user!.businessId,
      userId: req.user!.id,
      deviceKey,
      ...payload,
      status,
      approvedAt: status === "approved" ? new Date() : null,
      approvedByUserId: status === "approved" ? req.user!.id : null,
    });

    return ok(res, { device, requiresApproval: status !== "approved" }, "Device registered", 201);
  };

  listAll = async (req: Request, res: Response) => {
    const status = String(req.query.status || "").trim();
    const where: any = { businessId: req.user!.businessId };
    if (status) where.status = status;

    const devices = await db.TrustedDevice.findAll({
      where,
      include: [
        { model: db.User, as: "user", attributes: ["id", "fullName", "email"] },
        { model: db.User, as: "approvedBy", attributes: ["id", "fullName", "email"] },
        { model: db.User, as: "rejectedBy", attributes: ["id", "fullName", "email"] },
      ],
      order: [["status", "ASC"], ["createdAt", "DESC"]],
    });
    return ok(res, { devices }, "Employee devices");
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    const device = await db.TrustedDevice.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
    if (!device) return next({ statusCode: 404, message: "Device not found" });

    await device.update({
      status: "approved",
      approvedAt: new Date(),
      approvedByUserId: req.user!.id,
      rejectedAt: null,
      rejectedByUserId: null,
    });
    return ok(res, { device }, "Device approved");
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    const device = await db.TrustedDevice.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
    if (!device) return next({ statusCode: 404, message: "Device not found" });

    await device.update({
      status: "rejected",
      rejectedAt: new Date(),
      rejectedByUserId: req.user!.id,
    });
    return ok(res, { device }, "Device rejected");
  };
}
