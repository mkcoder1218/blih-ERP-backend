"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalDeadlineReminder = void 0;
const models_1 = require("../../models");
exports.approvalDeadlineReminder = {
    name: 'ApprovalDeadlineReminder',
    type: 'notification',
    cronExpression: '0 8 * * *', // Daily at 8 AM
    handler: async () => {
        // Mock logic to scan pending approvals crossing deadline
        // In an actual scenario this limits search to active businessIds and un-suspended
        const pendingApprovals = await models_1.db.ApprovalRequest.findAll({
            where: { status: 'pending' },
            include: [{ model: models_1.db.Business }] // requires checking business active sub ideally
        });
        // Iterate and push notification triggers mock
    }
};
