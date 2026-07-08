"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedEthiopianLeaveTemplatesForBusiness = seedEthiopianLeaveTemplatesForBusiness;
exports.seedEthiopianLeaveTemplatesForAllBusinesses = seedEthiopianLeaveTemplatesForAllBusinesses;
const sequelize_1 = require("sequelize");
const models_1 = require("../../../models");
const PROCLAMATION_REFERENCE = "Ethiopian Labour Proclamation No. 1156/2019";
const ETHIOPIAN_LEAVE_TEMPLATES = [
    {
        name: "Annual Leave",
        leaveType: "annual",
        hasAmount: true,
        totalDays: 16,
        description: "Paid annual leave under Articles 76-80. Minimum entitlement is 16 working days after the first year of service, plus 1 additional working day for every two additional years of service. The worker receives the same wage as if working, and annual leave is generally not waived or replaced by payment while employment continues.",
        requiresEvidence: false,
        evidenceInstructions: null,
        isActive: true,
        isVisibleForRequest: true,
        isDeprecated: false,
    },
    {
        name: "Sick Leave",
        leaveType: "sick",
        hasAmount: true,
        totalDays: 180,
        description: "Sick leave under Articles 85-86. After completing probation, a worker who is unable to work due to sickness may receive up to 6 months within a 12-month period: first month at 100% wages, next two months at 50% wages, and remaining three months unpaid.",
        requiresEvidence: true,
        evidenceInstructions: "Attach a medical certificate or other medical evidence where required.",
        isActive: true,
        isVisibleForRequest: true,
        isDeprecated: false,
    },
    {
        name: "Maternity Leave",
        leaveType: "maternity",
        hasAmount: true,
        totalDays: 120,
        description: "Maternity leave under Article 88. A pregnant worker is entitled to 30 consecutive days pre-natal leave and 90 consecutive days post-natal leave, totaling 120 days with full pay. Paid leave may also be granted for pregnancy-related medical examinations when supported by medical evidence.",
        requiresEvidence: true,
        evidenceInstructions: "Attach pregnancy-related medical evidence, including examination documentation where applicable.",
        isActive: true,
        isVisibleForRequest: true,
        isDeprecated: false,
    },
    {
        name: "Paternity Leave",
        leaveType: "paternity",
        hasAmount: true,
        totalDays: 3,
        description: "Paid paternity leave under Article 81. A male worker is entitled to 3 consecutive days of paid paternity leave.",
        requiresEvidence: false,
        evidenceInstructions: null,
        isActive: true,
        isVisibleForRequest: true,
        isDeprecated: false,
    },
    {
        name: "Wedding Leave",
        leaveType: "wedding",
        hasAmount: true,
        totalDays: 3,
        description: "Marriage leave under Article 81(1). A worker who gets married is entitled to 3 working days of paid leave.",
        requiresEvidence: true,
        evidenceInstructions: "Attach marriage-related supporting evidence if requested.",
        isActive: true,
        isVisibleForRequest: true,
        isDeprecated: false,
    },
    {
        name: "Bereavement Leave",
        leaveType: "bereavement",
        hasAmount: true,
        totalDays: 3,
        description: "Bereavement leave under Article 81(1). A worker is entitled to 3 working days of paid leave when the worker's spouse, descendant, ascendant, brother, sister, uncle, aunt, or relative by blood or marriage dies.",
        requiresEvidence: true,
        evidenceInstructions: "Attach bereavement or family-event supporting evidence if requested.",
        isActive: true,
        isVisibleForRequest: true,
        isDeprecated: false,
    },
    {
        name: "Serious Personal Event Leave",
        leaveType: "serious_personal_event",
        hasAmount: true,
        totalDays: 5,
        description: "Unpaid special leave under Article 81(3). A worker may receive up to 5 consecutive days of unpaid leave for exceptional and serious events, granted only twice in a budget year.",
        requiresEvidence: true,
        evidenceInstructions: "Describe the exceptional event and attach supporting evidence if requested.",
        isActive: true,
        isVisibleForRequest: true,
        isDeprecated: false,
    },
    {
        name: "Union Leave",
        leaveType: "union",
        hasAmount: false,
        totalDays: 0,
        description: "Union leave under Article 82. Trade union leaders may receive paid leave for labour dispute proceedings, collective bargaining, union meetings, seminars, and training related to union duties.",
        requiresEvidence: true,
        evidenceInstructions: "Attach union duty, meeting, proceeding, seminar, or training evidence.",
        isActive: true,
        isVisibleForRequest: true,
        isDeprecated: false,
    },
    {
        name: "Special Purpose Leave",
        leaveType: "special_purpose",
        hasAmount: false,
        totalDays: 0,
        description: "Paid special purpose leave under Article 83. Leave is granted for appearing before labour dispute bodies, exercising voting rights, or serving as a witness before judicial or quasi-judicial bodies.",
        requiresEvidence: true,
        evidenceInstructions: "Attach summons, voting, witness, or other official supporting evidence.",
        isActive: true,
        isVisibleForRequest: true,
        isDeprecated: false,
    },
    {
        name: "Weekly Rest and Public Holiday",
        leaveType: "public_holiday_rest",
        hasAmount: false,
        totalDays: 0,
        description: "Workers are entitled to a weekly rest period of at least 24 consecutive hours in each seven-day period. Public holiday and rest-day rights are protected under the labour law framework.",
        requiresEvidence: false,
        evidenceInstructions: null,
        isActive: true,
        isVisibleForRequest: true,
        isDeprecated: false,
    },
];
const OBSOLETE_DEFAULT_LEAVE_TYPES = ["casual", "unpaid"];
async function seedEthiopianLeaveTemplatesForBusiness(businessId) {
    const obsoleteTemplates = await models_1.db.LeaveTemplate.findAll({
        where: {
            businessId,
            leaveType: { [sequelize_1.Op.in]: OBSOLETE_DEFAULT_LEAVE_TYPES },
        },
    });
    for (const template of obsoleteTemplates) {
        const linked = await models_1.db.LeaveRequest.count({ where: { businessId, leaveTemplateId: template.id } });
        if (linked > 0) {
            await template.update({ isActive: false, isVisibleForRequest: false, isDeprecated: true });
        }
        else {
            await template.destroy();
        }
    }
    for (const template of ETHIOPIAN_LEAVE_TEMPLATES) {
        const existing = await models_1.db.LeaveTemplate.findOne({
            where: { businessId, leaveType: template.leaveType },
        });
        const values = {
            ...template,
            description: `${template.description}\n\nReference: ${PROCLAMATION_REFERENCE}.`,
            businessId,
            createdBy: null,
        };
        if (existing) {
            await existing.update(values);
        }
        else {
            await models_1.db.LeaveTemplate.create(values);
        }
    }
}
async function seedEthiopianLeaveTemplatesForAllBusinesses() {
    const businesses = await models_1.db.Business.findAll({ attributes: ["id"] });
    for (const business of businesses) {
        await seedEthiopianLeaveTemplatesForBusiness(business.id);
    }
}
