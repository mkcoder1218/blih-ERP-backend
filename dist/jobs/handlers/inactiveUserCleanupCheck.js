"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inactiveUserCleanupCheck = void 0;
exports.inactiveUserCleanupCheck = {
    name: 'InactiveUserCleanupCheck',
    type: 'maintenance',
    cronExpression: '0 2 * * 0', // Weekly sunday 2am
    handler: async () => {
        // Disable users inactive > 90 days
    }
};
