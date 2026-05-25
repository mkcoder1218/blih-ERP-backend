"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const package_json_1 = __importDefault(require("../../package.json"));
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Blih ERP API',
            version: package_json_1.default.version,
            description: 'API documentation for Blih ERP backend system. Tenant isolation applied on most routes requiring Bearer Token and implicit business logic boundaries.',
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            responses: {
                '400': { description: 'Bad Request - Validation or logic error' },
                '401': { description: 'Unauthorized - Missing or invalid Bearer Token' },
                '403': { description: 'Forbidden - Insufficient permissions or wrong tenant bound' },
                '404': { description: 'Resource Not Found' },
                '500': { description: 'Internal Server Error' },
            }
        },
        security: [{ bearerAuth: [] }],
    },
    // Keep Swagger intentionally minimal for now (auth + business provisioning only)
    apis: [
        './src/modules/auth/auth.routes.ts',
        './src/modules/business/business.routes.ts'
    ],
};
exports.swaggerSpec = (0, swagger_jsdoc_1.default)(options);
