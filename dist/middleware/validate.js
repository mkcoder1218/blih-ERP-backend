"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
function validate(schema, property = "body") {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], { abortEarly: false, stripUnknown: true });
        if (error) {
            return next({
                statusCode: 400,
                message: "Validation error",
                details: error.details.map((d) => ({ message: d.message, path: d.path }))
            });
        }
        req[property] = value;
        next();
    };
}
