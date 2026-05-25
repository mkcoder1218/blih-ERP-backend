import swaggerJsdoc from 'swagger-jsdoc';
import pkg from '../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Blih ERP API',
      version: pkg.version,
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

export const swaggerSpec = swaggerJsdoc(options);
