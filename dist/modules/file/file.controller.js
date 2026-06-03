"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileController = void 0;
const file_service_1 = require("./file.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const fs_1 = __importDefault(require("fs"));
const jwt_1 = require("../../utils/jwt");
class FileController {
    constructor() {
        this.service = new file_service_1.FileService();
        this.list = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const moduleKey = req.query.moduleKey || "";
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            const data = await this.service.list(businessId, moduleKey, page, size);
            const safeData = data.rows.map((r) => {
                const d = r.toJSON();
                if (!req.user.isPlatformSuperAdmin)
                    delete d.storagePath;
                d.downloadUrl = `/api/files/${d.id}/download`;
                return d;
            });
            res.json({ count: data.count, rows: safeData });
        };
        /** Issue a short-lived (60s) signed download token for a file. Requires auth. */
        this.getDownloadToken = async (req, res, next) => {
            try {
                const businessId = this.deriveBusinessId(req);
                const asset = await this.service.getById(req.params.id, businessId);
                if (!asset || asset.status !== 'active')
                    return next({ statusCode: 404, message: 'File not found or inactive' });
                const token = (0, jwt_1.signDownloadToken)(req.user.id, businessId, asset.id);
                res.json({ token });
            }
            catch (err) {
                next({ statusCode: 500, message: err.message });
            }
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
            try {
                let fileId = req.params.id;
                let businessId;
                // Support token-based download (no Authorization header needed — works with IDM/browser direct open)
                const queryToken = req.query.token;
                if (queryToken) {
                    const payload = (0, jwt_1.verifyDownloadToken)(queryToken);
                    if (payload.fileId !== fileId)
                        return next({ statusCode: 403, message: 'Token does not match file' });
                    businessId = payload.businessId;
                }
                else {
                    // Fallback to normal auth (req.user set by authRequired middleware)
                    if (!req.user)
                        return next({ statusCode: 401, message: 'Missing access token' });
                    businessId = this.deriveBusinessId(req);
                }
                console.log(`[DOWNLOAD] id=${fileId} businessId=${businessId} origin=${req.headers.origin ?? 'none'}`);
                const asset = await this.service.getById(fileId, businessId);
                console.log(`[DOWNLOAD] asset=${JSON.stringify(asset ? { id: asset.id, status: asset.status, storagePath: asset.storagePath } : null)}`);
                if (!asset || asset.status !== 'active')
                    return next({ statusCode: 404, message: 'File not found or inactive' });
                if (!fs_1.default.existsSync(asset.storagePath)) {
                    console.log(`[DOWNLOAD] physical file missing at path: ${asset.storagePath}`);
                    return next({ statusCode: 404, message: 'Physical file missing' });
                }
                const origin = req.headers.origin;
                if (origin) {
                    res.setHeader('Access-Control-Allow-Origin', origin);
                    res.setHeader('Vary', 'Origin');
                }
                res.setHeader('Access-Control-Allow-Credentials', 'true');
                res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
                res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
                const shouldPreview = req.query.preview === '1';
                res.setHeader('Content-Disposition', `${shouldPreview ? 'inline' : 'attachment'}; filename="${encodeURIComponent(asset.originalName)}"`);
                res.setHeader('Content-Type', shouldPreview ? asset.mimeType : 'application/octet-stream');
                const fileStream = fs_1.default.createReadStream(asset.storagePath);
                fileStream.on('error', (err) => {
                    console.error('[DOWNLOAD] stream error:', err);
                    next({ statusCode: 500, message: 'Failed to stream file' });
                });
                fileStream.pipe(res);
            }
            catch (err) {
                next({ statusCode: 401, message: err.message || 'Invalid download token' });
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
