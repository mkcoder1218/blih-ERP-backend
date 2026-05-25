
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10); // Default 10MB
const ALLOWED_MIME_TYPES = process.env.ALLOWED_MIME_TYPES ? process.env.ALLOWED_MIME_TYPES.split(',') : ['image/jpeg', 'image/png', 'application/pdf', 'text/csv'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Derive structure: /uploads/{businessId}/{moduleKey}/
    const businessId = req.user?.businessId || 'anonymous';
    const moduleKey = req.body.moduleKey || 'general';
    const uploadPath = path.join(process.cwd(), 'uploads', businessId, moduleKey);
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, safeName);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'));
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});
