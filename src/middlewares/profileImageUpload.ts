import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";

const MAX_PROFILE_IMAGE_SIZE = Number(process.env.MAX_PROFILE_IMAGE_SIZE || 10 * 1024 * 1024);
const ALLOWED_PROFILE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_PROFILE_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const businessId = req.user?.businessId || req.body.businessId || "anonymous";
    const uploadPath = path.join(process.cwd(), "uploads", businessId, "profile-images");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomBytes(16).toString("hex")}${ext}`);
  }
});

export const uploadProfileImage = multer({
  storage,
  limits: { fileSize: MAX_PROFILE_IMAGE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "profileImage" && ALLOWED_PROFILE_IMAGE_TYPES.has(file.mimetype)) return cb(null, true);
    if ((file.fieldname === "document" || file.fieldname === "documents") && ALLOWED_PROFILE_DOCUMENT_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new Error("Unsupported profile upload type"));
  }
});

export function profileImageUrl(file?: Express.Multer.File) {
  if (!file) return null;
  const rel = path.relative(process.cwd(), file.path).replace(/\\/g, "/");
  return `/${rel}`;
}
