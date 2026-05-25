import type { NextFunction, Request, Response } from "express";
import type Joi from "joi";

export function validate(schema: Joi.ObjectSchema, property: "body" | "params" | "query" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate((req as any)[property], { abortEarly: false, stripUnknown: true });
    if (error) {
      return next({
        statusCode: 400,
        message: "Validation error",
        details: error.details.map((d) => ({ message: d.message, path: d.path }))
      });
    }
    (req as any)[property] = value;
    next();
  };
}

