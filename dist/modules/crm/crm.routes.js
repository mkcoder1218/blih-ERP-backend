"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicCRMRoutes = exports.crmRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const requireActiveModule_1 = require("../../middlewares/requireActiveModule");
const asyncHandler_1 = require("../../utils/asyncHandler");
const crm_controller_1 = require("./crm.controller");
const router = (0, express_1.Router)();
const controller = new crm_controller_1.CRMController();
// App boundary
router.use((0, requireActiveModule_1.requireActiveModule)('crm'));
// Protected Routes
/**
 * @openapi
 * /api/v1/crm/templates:
 *   post:
 *     tags: [crm]
 *     summary: POST /templates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/templates', auth_1.authRequired, (0, role_1.requireRole)('CRM_MANAGER', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.seedForms));
// Leads
/**
 * @openapi
 * /api/v1/crm/leads:
 *   post:
 *     tags: [crm]
 *     summary: POST /leads
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/leads', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.createLead));
/**
 * @openapi
 * /api/v1/crm/leads:
 *   get:
 *     tags: [crm]
 *     summary: GET /leads
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/leads', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.listLeads));
/**
 * @openapi
 * /api/v1/crm/leads/{id}:
 *   patch:
 *     tags: [crm]
 *     summary: PATCH /leads/:id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.patch('/leads/:id', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.updateLead));
/**
 * @openapi
 * /api/v1/crm/leads/{id}/assign:
 *   patch:
 *     tags: [crm]
 *     summary: PATCH /leads/:id/assign
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.patch('/leads/:id/assign', auth_1.authRequired, (0, role_1.requireRole)('CRM_MANAGER', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.assignLead));
/**
 * @openapi
 * /api/v1/crm/leads/{id}/convert-to-deal:
 *   post:
 *     tags: [crm]
 *     summary: POST /leads/:id/convert-to-deal
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/leads/:id/convert-to-deal', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.convertToDeal));
// Deals
/**
 * @openapi
 * /api/v1/crm/deals:
 *   post:
 *     tags: [crm]
 *     summary: POST /deals
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/deals', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.createDeal));
/**
 * @openapi
 * /api/v1/crm/deals:
 *   get:
 *     tags: [crm]
 *     summary: GET /deals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/deals', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.listDeals));
/**
 * @openapi
 * /api/v1/crm/deals/{id}/convert-to-client:
 *   post:
 *     tags: [crm]
 *     summary: POST /deals/:id/convert-to-client
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/deals/:id/convert-to-client', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.convertToClient));
// Interactions
/**
 * @openapi
 * /api/v1/crm/interactions:
 *   post:
 *     tags: [crm]
 *     summary: POST /interactions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/interactions', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.createInteraction));
/**
 * @openapi
 * /api/v1/crm/interactions:
 *   get:
 *     tags: [crm]
 *     summary: GET /interactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/interactions', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.listInteractions));
// Proposals
/**
 * @openapi
 * /api/v1/crm/proposals:
 *   post:
 *     tags: [crm]
 *     summary: POST /proposals
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/proposals', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.createProposal));
/**
 * @openapi
 * /api/v1/crm/proposals:
 *   get:
 *     tags: [crm]
 *     summary: GET /proposals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/proposals', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.listProposals));
// Clients
/**
 * @openapi
 * /api/v1/crm/clients:
 *   post:
 *     tags: [crm]
 *     summary: POST /clients
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/clients', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.createClient));
/**
 * @openapi
 * /api/v1/crm/clients:
 *   get:
 *     tags: [crm]
 *     summary: GET /clients
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/clients', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.listClients));
exports.crmRoutes = router;
exports.publicCRMRoutes = (0, express_1.Router)();
exports.publicCRMRoutes.post('/leads', (0, asyncHandler_1.asyncHandler)(controller.publicCreateLead));
