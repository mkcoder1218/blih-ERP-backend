"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileController = void 0;
const file_service_1 = require("./file.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const fs_1 = __importDefault(require("fs"));
class FileController {
    constructor() {
        this.service = new file_service_1.FileService();
        this.list = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const moduleKey = req.query.moduleKey || "";
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            const data = await this.service.list(businessId, moduleKey, page, size);
            // Hide pure local paths for safety unless super admin, map to secure download route
            const safeData = data.rows.map((r) => {
                const d = r.toJSON();
                if (!req.user.isPlatformSuperAdmin)
                    delete d.storagePath;
                d.downloadUrl = `/api/files/${d.id}/download`;
                return d;
            });
            res.json({ count: data.count, rows: safeData });
        };
        this.uploadSingle = async (req, res, next) => {
            try {
                if (!req.file)
                    throw new Error("No file uploaded");
                const r = await this.service.saveAssetRecord(req.user.businessId, req.user.id, req.file);
                await auditLog_service_1.AuditLogService.log('UPLOAD_FILE', 'file_asset', r.id, null, r, req);
                const safeData = r.toJSON();
                if (!req.user.isPlatformSuperAdmin)
                    delete safeData.storagePath;
                safeData.downloadUrl = `/api/files/${safeData.id}/download`;
                res.status(201).json({ file: safeData });
            }
            catch (err) {
                next({ statusCode: 400, message: err.message });
            }
        };
        this.uploadMultiple = async (req, res, next) => {
            try {
                if (!req.files || !Array.isArray(req.files))
                    throw new Error("No files uploaded");
                const files = [];
                for (const f of req.files) {
                    const r = await this.service.saveAssetRecord(req.user.businessId, req.user.id, f);
                    await auditLog_service_1.AuditLogService.log('UPLOAD_FILE', 'file_asset', r.id, null, r, req);
                    const safeData = r.toJSON();
                    if (!req.user.isPlatformSuperAdmin)
                        delete safeData.storagePath;
                    safeData.downloadUrl = `/api/files/${safeData.id}/download`;
                    files.push(safeData);
                }
                res.status(201).json({ files });
            }
            catch (err) {
                next({ statusCode: 400, message: err.message });
            }
        };
        this.download = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const asset = await this.service.getById(req.params.id, businessId);
            if (!asset || asset.status !== 'active')
                return next({ statusCode: 404, message: 'File not found or inactive' });
            if (fs_1.default.existsSync(asset.storagePath)) {
                res.download(asset.storagePath, asset.originalName);
            }
            else {
                next({ statusCode: 404, message: 'Physical file missing' });
            }
        };
        this.remove = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const ok = await this.service.softDelete(req.params.id, businessId);
            if (!ok)
                return next({ statusCode: 404, message: 'File not found' });
            await auditLog_service_1.AuditLogService.log('DELETE_FILE', 'file_asset', req.params.id, null, null, req);
            res.json({ ok: true });
        };
    }
    deriveBusinessId(req) { return req.user.isPlatformSuperAdmin && req.query.businessId ? req.query.businessId : req.user.businessId; }
}
exports.FileController = FileController;
