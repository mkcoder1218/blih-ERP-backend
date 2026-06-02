"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = void 0;
const file_dal_1 = require("./file.dal");
class FileService {
    constructor() {
        this.dal = new file_dal_1.FileDAL();
    }
    list(businessId, moduleKey, page, size) {
        const offset = (page - 1) * size;
        const query = { businessId };
        if (moduleKey)
            query.moduleKey = moduleKey;
        return this.dal.findAll(query, offset, size);
    }
    getById(id, businessId) { return this.dal.findById(id, businessId); }
    async saveAssetRecord(businessId, userId, file, extraMetadata = {}) {
        return this.dal.create({
            businessId,
            uploadedByUserId: userId || null,
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            storageProvider: 'local',
            storagePath: file.path,
            status: 'active',
            metadata: extraMetadata,
        });
    }
    softDelete(id, businessId) { return this.dal.softDelete(id, businessId); }
}
exports.FileService = FileService;
