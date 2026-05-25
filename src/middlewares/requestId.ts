
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const addRequestId = (req: Request, res: Response, next: NextFunction) => {
   const reqId = req.headers['x-request-id'] || crypto.randomUUID();
   (res as any).locals.requestId = reqId;
   res.setHeader('X-Request-Id', reqId as string);
   next();
};
