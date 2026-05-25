# File & Document Attachment Engine Implementation

## Overview
Replaces ad-hoc string URLs and manual base64 conversion blocks with a dedicated `multer`-driven File Engine. This implementation provides comprehensive tracking, robust isolation, and dynamic relational associations (`EntityAttachment`) to map generated documents against *any* abstract DB model natively.

## 1. Safety & Architecture
Configured natively in `src/middlewares/upload.ts`:
- **Multer Storage Adapter**: Secures incoming uploads and drops them asynchronously onto the local disk (`/uploads/{businessId}/{moduleKey}/`).
- **Filename Hardening**: Automatically strips all user-provided file names in transit. It resolves native ext-signatures and converts the root hash via `crypto.randomBytes(16)` algorithm to ensure no Path-Traversal payload escapes containment.
- **Strict Size/Type Limits**: The `fileFilter` middleware aggressively blocks anything failing implicit `MimeType` lists defined in the global `.env` scope (falling back effectively to standard image and PDF layouts). File size limits cap at an adjustable ceiling (10 MB).

## 2. Abstractions Layer (Models)
Located inside `src/models`:
- **`FileAsset`**: Holds generic metrics such as `mimeType`, `sizeBytes`, string URL abstractions (`storagePath`), and ownership links back to the user interacting with the engine (`uploadedByUserId`).
- **`EntityAttachment`**: A purely relational linking map. When you drop a PDF, you immediately query `EntityAttachment` pushing the UUID alongside `{ entityType: 'form_submission', entityId: '<UUID>' }` to statically bind that file to an abstract module block implicitly.

## 3. Dynamic Masking Configuration (`file.controller.ts`)
To prevent internal physical structure leaks, the response payload abstracts out `storagePath` directly prior to transit for anyone that isn't a certified `PLATFORM_SUPER_ADMIN`. 

```typescript
const safeData = data.rows.map((r: any) => {
  const d = r.toJSON();
  if (!req.user!.isPlatformSuperAdmin) delete d.storagePath;
  d.downloadUrl = \`/api/files/\${d.id}/download\`; // Injects secure router URL mask
  return d;
});
```
*(Downloading operations correctly pass this generated safe boundary API to access the real file location and buffer down to the client securely).*

## 4. Interaction Endpoints
Wrapped deeply under standard `authRequired` interceptors:
- Native single arrays: `POST /api/files/upload`.
- Multi-form payload handling: `POST /api/files/upload/bulk`.
- Secure mapping logic: `POST /api/attachments/`.
- Deep Audit interception triggering automatically on `uploadSingle`, `uploadMultiple`, `remove`, and map associations.
