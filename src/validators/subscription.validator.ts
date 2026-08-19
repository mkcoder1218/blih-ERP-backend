import Joi from "joi";
const uuid = Joi.string().uuid();
export const changePlanSchema = Joi.object({ planId: uuid.required() });
export const invoiceSchema = Joi.object({
  discountAmount: Joi.number().min(0).default(0), taxAmount: Joi.number().min(0).default(0), dueDate: Joi.date()
});
export const adminSchemas: Record<string, Joi.ObjectSchema> = {
  features: Joi.object({ key: Joi.string().max(100).required(), name: Joi.string().max(150).required(), description: Joi.string().allow(null, ""), category: Joi.string().max(100).allow(null, ""), isMetered: Joi.boolean().default(false), unitName: Joi.string().max(50).allow(null, "") }),
  "plan-features": Joi.object({ planId: uuid.required(), featureId: uuid.required(), isEnabled: Joi.boolean().required(), limitValue: Joi.number().min(0).allow(null), limitPeriod: Joi.string().valid("daily", "monthly", "yearly", "lifetime").allow(null) }),
  subscriptions: Joi.object({ businessId: uuid.required(), planId: uuid.required(), status: Joi.string().valid("trialing", "active", "past_due", "canceled", "expired").required(), startDate: Joi.date(), currentPeriodStart: Joi.date().required(), currentPeriodEnd: Joi.date().required(), trialEndsAt: Joi.date().allow(null), cancelAtPeriodEnd: Joi.boolean(), canceledAt: Joi.date().allow(null), pendingPlanId: uuid.allow(null) }),
  usage: Joi.object({ businessId: uuid.required(), subscriptionId: uuid.required(), featureId: uuid.required(), quantity: Joi.number().positive().required(), unitPrice: Joi.number().min(0).required(), totalPrice: Joi.number().min(0), usageDate: Joi.date(), billingPeriod: Joi.string().max(20).required(), metadata: Joi.object() }),
  payments: Joi.object({ invoiceId: uuid.required(), businessId: uuid.required(), amount: Joi.number().positive().required(), currency: Joi.string().length(3).required(), provider: Joi.string().max(50).required(), providerReference: Joi.string().max(255).allow(null, ""), status: Joi.string().valid("pending", "paid", "failed", "refunded"), paidAt: Joi.date().allow(null), metadata: Joi.object() }),
  invoices: Joi.object({ businessId: uuid.required(), subscriptionId: uuid.required(), invoiceNumber: Joi.string().max(100).required(), baseAmount: Joi.number().min(0).required(), seatAmount: Joi.number().min(0).required(), usageAmount: Joi.number().min(0).required(), discountAmount: Joi.number().min(0), taxAmount: Joi.number().min(0), totalAmount: Joi.number().min(0).required(), currency: Joi.string().length(3).required(), status: Joi.string().valid("draft", "issued", "paid", "failed", "void"), periodStart: Joi.date().required(), periodEnd: Joi.date().required(), dueDate: Joi.date().required(), paidAt: Joi.date().allow(null) })
};
