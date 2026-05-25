
import type { Request, Response, NextFunction } from 'express';
// Augment request namespace inline for demonstration; in a true production app, would extend AuthUser.
export const captureImpersonation = (req: Request, res: Response, next: NextFunction) => {
   // If our JWT payload contained impersonatedBy mapping from adminOps.service
   if (req.user && (req.user as any).impersonatedBy) {
       (req as any).impersonatorMetadata = {
           impersonatedBy: (req.user as any).impersonatedBy,
           sessionId: (req.user as any).impersonationSessionId
       };
   }
   next();
};
