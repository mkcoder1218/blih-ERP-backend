"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const business_1 = require("../validators/business");
const models_1 = require("../models");
const router = (0, express_1.Router)();
router.use(auth_1.authRequired);
router.get("/", async (req, res, next) => {
    try {
        if (req.user?.isPlatformSuperAdmin) {
            const businesses = await models_1.models.Business.findAll({ where: { deletedAt: null } });
            return res.json({ businesses });
        }
        const business = await models_1.models.Business.findByPk(req.user?.businessId);
        if (!business || business.deletedAt)
            return next({ statusCode: 404, message: "Business not found" });
        res.json({ businesses: [business] });
    }
    catch (err) {
        next(err);
    }
});
router.get("/:id", async (req, res, next) => {
    try {
        const business = await models_1.models.Business.findByPk(req.params.id);
        if (!business || business.deletedAt)
            return next({ statusCode: 404, message: "Business not found" });
        if (!req.user?.isPlatformSuperAdmin && business.id !== req.user?.businessId) {
            return next({ statusCode: 403, message: "Forbidden (tenant)" });
        }
        res.json({ business });
    }
    catch (err) {
        next(err);
    }
});
router.post("/", (0, validate_1.validate)(business_1.createBusinessSchema), async (req, res, next) => {
    try {
        if (!req.user?.isPlatformSuperAdmin)
            return next({ statusCode: 403, message: "Only Platform Super Admin can create businesses" });
        const business = await models_1.models.Business.create({ ...req.body, isActive: true, deletedAt: null });
        res.status(201).json({ business });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/:id", (0, validate_1.validate)(business_1.updateBusinessSchema), async (req, res, next) => {
    try {
        const business = await models_1.models.Business.findByPk(req.params.id);
        if (!business || business.deletedAt)
            return next({ statusCode: 404, message: "Business not found" });
        if (!req.user?.isPlatformSuperAdmin && business.id !== req.user?.businessId) {
            return next({ statusCode: 403, message: "Forbidden (tenant)" });
        }
        await business.update(req.body);
        res.json({ business });
    }
    catch (err) {
        next(err);
    }
});
router.delete("/:id", async (req, res, next) => {
    try {
        if (!req.user?.isPlatformSuperAdmin)
            return next({ statusCode: 403, message: "Only Platform Super Admin can delete businesses" });
        const business = await models_1.models.Business.findByPk(req.params.id);
        if (!business || business.deletedAt)
            return next({ statusCode: 404, message: "Business not found" });
        await business.update({ deletedAt: new Date(), isActive: false });
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
