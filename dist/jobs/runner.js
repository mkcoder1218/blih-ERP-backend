"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobRunner = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const env_1 = require("../config/env");
const models_1 = require("../models");
const activeJobs = new Set();
class JobRunner {
    static register(job) {
        if (job.enabled === false)
            return;
        node_cron_1.default.schedule(job.cronExpression, async () => {
            if (activeJobs.has(job.name)) {
                console.log(`Job ${job.name} skipped: already running.`);
                return;
            }
            activeJobs.add(job.name);
            const log = await models_1.db.BackgroundJobLog.create({
                jobName: job.name,
                jobType: job.type,
                status: 'running',
                startedAt: new Date(),
                attempts: 1
            });
            try {
                await job.handler();
                await log.update({
                    status: 'success',
                    finishedAt: new Date()
                });
            }
            catch (err) {
                console.error(`Job ${job.name} failed: ${err.message}`);
                await log.update({
                    status: 'failed',
                    finishedAt: new Date(),
                    errorMessage: err.message
                });
            }
            finally {
                activeJobs.delete(job.name);
            }
        }, {
            timezone: env_1.env.jobTimezone
        });
        console.log(`Job registered: ${job.name} (${job.cronExpression})`);
    }
}
exports.JobRunner = JobRunner;
