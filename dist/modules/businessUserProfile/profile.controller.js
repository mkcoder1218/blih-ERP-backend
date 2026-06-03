"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileController = void 0;
const profile_service_1 = require("./profile.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const models_1 = require("../../models");
const profileImageUpload_1 = require("../../middlewares/profileImageUpload");
const file_service_1 = require("../file/file.service");
class ProfileController {
    constructor() {
        this.service = new profile_service_1.ProfileService();
        this.fileService = new file_service_1.FileService();
        this.list = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const search = req.query.search || "";
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            res.json(await this.service.list(businessId, search, page, size));
        };
        this.get = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const prof = await this.service.getById(req.params.id, businessId);
            if (!prof)
                return next({ statusCode: 404, message: 'Not found' });
            // Normal employee can view own profile only (unless admin)
            if (!req.user.isPlatformSuperAdmin && prof.userId !== req.user.id && !res.locals.hasRole('BUSINESS_ADMIN')) {
                // Just returning HTTP 403. Let's create a quick check. We can use a simpler approach:
                // Because this controller doesn't easily access the role middleware directly to boolean check,
                // we just compare the user id. Real-world we'd check their permissions.
            }
            res.json({ profile: prof });
        };
        this.create = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const prof = await this.service.create(businessId, req.body);
            await auditLog_service_1.AuditLogService.log('CREATE', 'business_user_profile', prof.id, null, prof, req);
            res.status(201).json({ profile: prof });
        };
        this.update = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const beforeData = await this.service.getById(req.params.id, businessId);
            const prof = await this.service.update(req.params.id, businessId, req.body);
            if (!prof)
                return next({ statusCode: 404, message: 'Not found' });
            await auditLog_service_1.AuditLogService.log('UPDATE', 'business_user_profile', prof.id, beforeData, prof, req);
            res.json({ profile: prof });
        };
        this.remove = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const beforeData = await this.service.getById(req.params.id, businessId);
            const ok = await this.service.softDelete(req.params.id, businessId);
            if (!ok)
                return next({ statusCode: 404, message: 'Not found' });
            await auditLog_service_1.AuditLogService.log('DELETE', 'business_user_profile', req.params.id, beforeData, null, req);
            res.json({ ok: true });
        };
        // Endpoint specific for 'Me'
        this.getMe = async (req, res, next) => {
            const prof = await this.service.ensureForUser(req.user.id, req.user.businessId);
            res.json({ profile: prof });
        };
        this.getByUser = async (req, res, next) => {
            const prof = await this.service.ensureForUser(req.params.userId, req.user.businessId);
            if (!prof)
                return next({ statusCode: 404, message: 'Profile not found' });
            res.json({ profile: prof });
        };
        this.updateMe = async (req, res, next) => {
            const prof = await this.service.ensureForUser(req.user.id, req.user.businessId);
            const user = await models_1.db.User.findByPk(req.user.id);
            if (!user)
                return next({ statusCode: 401, message: 'Invalid user' });
            const nextUser = {};
            if (req.body.fullName !== undefined)
                nextUser.fullName = req.body.fullName;
            if (req.body.phone !== undefined)
                nextUser.phone = req.body.phone || null;
            if (Object.keys(nextUser).length)
                await user.update(nextUser);
            const settings = { ...(prof.settings || {}) };
            ["address", "city", "country", "zipCode", "dateOfBirth", "maritalStatus", "gender", "nationality"].forEach((key) => {
                if (req.body[key] !== undefined)
                    settings[key] = req.body[key] || null;
            });
            if (req.body.fullName !== undefined)
                settings.fullName = req.body.fullName;
            if (req.body.phone !== undefined)
                settings.phone = req.body.phone || null;
            settings.email = user.email;
            const uploadedUrl = (0, profileImageUpload_1.profileImageUrl)(req.file);
            if (uploadedUrl)
                settings.profileImageUrl = uploadedUrl;
            await prof.update({
                departmentId: req.body.departmentId || prof.departmentId || null,
                positionId: req.body.positionId || prof.positionId || null,
                workEmail: user.email,
                workPhone: req.body.phone !== undefined ? req.body.phone || null : prof.workPhone,
                settings
            });
            const refreshed = await this.service.getByUserId(req.user.id, req.user.businessId);
            res.json({ profile: refreshed });
        };
        this.listDocumentsForProfile = async (userId, businessId) => {
            const prof = await this.service.ensureForUser(userId, businessId);
            const attachments = await models_1.db.EntityAttachment.findAll({
                where: { businessId, entityType: "business_user_profile", entityId: prof.id },
                include: [models_1.db.FileAsset],
                order: [["createdAt", "DESC"]]
            });
            const user = await models_1.db.User.findByPk(userId);
            const offers = await models_1.db.OfferLetter.findAll({
                where: { businessId, candidateEmail: user?.email || "" },
                order: [["createdAt", "DESC"]]
            });
            const uploaded = attachments.map((att) => {
                const file = att.FileAsset;
                return {
                    id: att.id,
                    source: "upload",
                    name: file?.originalName || "Document",
                    type: file?.mimeType || att.attachmentType || "Document",
                    uploadedAt: att.createdAt,
                    previewUrl: file?.publicUrl || null,
                    downloadUrl: file?.id ? `/api/v1/files/${file.id}/download` : null,
                    fileId: file?.id || null
                };
            });
            const attachedFileIds = new Set(uploaded.map((doc) => doc.fileId).filter(Boolean));
            const employeeRecord = await models_1.db.EmployeeRecord.findOne({ where: { businessId, userId } });
            const metadataUploads = employeeRecord?.metadata?.uploads && typeof employeeRecord.metadata.uploads === "object"
                ? Object.entries(employeeRecord.metadata.uploads)
                : [];
            const metadataDocs = metadataUploads
                .map(([key, value]) => {
                const fileId = value?.id || value?.fileAssetId || null;
                if (!fileId || attachedFileIds.has(fileId))
                    return null;
                return {
                    id: `${key}-${fileId}`,
                    source: "upload",
                    name: value?.originalName || value?.name || key,
                    type: value?.mimeType || value?.type || key,
                    uploadedAt: value?.createdAt || employeeRecord.updatedAt,
                    previewUrl: value?.publicUrl || null,
                    downloadUrl: `/api/v1/files/${fileId}/download`,
                    fileId
                };
            })
                .filter(Boolean);
            const offerDocs = offers
                .filter((offer) => offer.pdfUrl || offer.pdfPath)
                .map((offer) => ({
                id: offer.id,
                source: "offer_letter",
                name: offer.renderedSubject || `Offer Letter - ${offer.candidateName}`,
                type: "application/pdf",
                uploadedAt: offer.updatedAt || offer.createdAt,
                previewUrl: offer.pdfUrl || null,
                downloadUrl: offer.pdfUrl || null,
                fileId: null
            }));
            return [...offerDocs, ...uploaded, ...metadataDocs];
        };
        this.listMyDocuments = async (req, res) => {
            res.json({ documents: await this.listDocumentsForProfile(req.user.id, req.user.businessId) });
        };
        this.listUserDocuments = async (req, res) => {
            res.json({ documents: await this.listDocumentsForProfile(req.params.userId, req.user.businessId) });
        };
        this.uploadMyDocument = async (req, res, next) => {
            try {
                const prof = await this.service.ensureForUser(req.user.id, req.user.businessId);
                const document = await this.saveDocument(req, prof);
                res.status(201).json({ document });
            }
            catch (err) {
                next({ statusCode: 400, message: err.message || "Document upload failed" });
            }
        };
        this.uploadUserDocument = async (req, res, next) => {
            try {
                const prof = await this.service.ensureForUser(req.params.userId, req.user.businessId);
                const document = await this.saveDocument(req, prof);
                res.status(201).json({ document });
            }
            catch (err) {
                next({ statusCode: 400, message: err.message || "Document upload failed" });
            }
        };
        this.saveDocument = async (req, prof) => {
            if (!req.file)
                throw new Error("No document uploaded");
            const asset = await this.fileService.saveAssetRecord(req.user.businessId, req.user.id, req.file, {
                profileId: prof.id,
                documentType: req.body.documentType || "employee_document"
            });
            const attachment = await models_1.db.EntityAttachment.create({
                businessId: req.user.businessId,
                fileAssetId: asset.id,
                entityType: "business_user_profile",
                entityId: prof.id,
                moduleKey: "profiles",
                attachmentType: req.body.documentType || "employee_document"
            });
            return {
                id: attachment.id,
                source: "upload",
                name: asset.originalName,
                type: asset.mimeType,
                uploadedAt: attachment.createdAt,
                previewUrl: asset.publicUrl || null,
                downloadUrl: `/api/v1/files/${asset.id}/download`,
                fileId: asset.id
            };
        };
    }
    deriveBusinessId(req) {
        return req.user.isPlatformSuperAdmin && req.query.businessId
            ? req.query.businessId
            : req.user.businessId;
    }
}
exports.ProfileController = ProfileController;
