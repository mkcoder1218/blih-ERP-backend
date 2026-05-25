"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireActiveModule = void 0;
const models_1 = require("../models");
const requireActiveModule = (moduleKey) => {
    return async (req, res, next) => {
        try {
            const businessId = req.user?.businessId;
            if (!businessId) {
                return next({ statusCode: 401, message: "Unauthorized" });
            }
            const businessModule = await models_1.db.BusinessModule.findOne({
                where: { businessId, moduleKey, status: "active" }
            });
            if (!businessModule) {
                return next({
                    statusCode: 403,
                    message: `Module '${moduleKey}' is not active for this business.`
                });
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.requireActiveModule = requireActiveModule;
