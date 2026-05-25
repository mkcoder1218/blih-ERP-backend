"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionExpiryCheck = void 0;
const models_1 = require("../../models");
const sequelize_1 = require("sequelize");
exports.subscriptionExpiryCheck = {
    name: 'SubscriptionExpiryCheck',
    type: 'billing',
    cronExpression: '0 0 * * *', // Midnight
    handler: async () => {
        const now = new Date();
        await models_1.db.Subscription.update({ status: 'expired' }, { where: { endDate: { [sequelize_1.Op.lt]: now }, status: 'active' } });
    }
};
