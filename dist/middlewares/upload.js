"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10); // Default 10MB
const ALLOWED_MIME_TYPES = process.env.ALLOWED_MIME_TYPES ? process.env.ALLOWED_MIME_TYPES.split(',') : ['image/jpeg', 'image/png', 'application/pdf', 'text/csv'];
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        // Derive structure: /uploads/{businessId}/{moduleKey}/
        const businessId = req.user?.businessId || 'anonymous';
        const moduleKey = req.body.moduleKey || 'general';
        const uploadPath = path_1.default.join(process.cwd(), 'uploads', businessId, moduleKey);
        if (!fs_1.default.existsSync(uploadPath)) {
            fs_1.default.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const safeName = crypto_1.default.randomBytes(16).toString('hex') + ext;
        cb(null, safeName);
    }
});
const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Invalid file type'));
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter
});
