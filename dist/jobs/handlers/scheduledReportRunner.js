"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledReportRunner = void 0;
exports.scheduledReportRunner = {
    name: 'ScheduledReportRunner',
    type: 'report',
    cronExpression: '0 * * * *', // Hourly sweep
    handler: async () => {
        // Find ReportDefinitions with schedule configurations that match current hour
    }
};
