import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { localizeResponsePayload, resolveRequestLanguage } from '../i18n/localization';

export const addRequestId = (req: Request, res: Response, next: NextFunction) => {
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();
  const language = resolveRequestLanguage(req);

  (res as any).locals.requestId = reqId;
  (res as any).locals.language = language;
  (req as any).language = language;

  res.setHeader('X-Request-Id', reqId as string);
  res.setHeader('Content-Language', language);
  res.vary('Accept-Language');
  res.vary('X-Locale');

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => originalJson(localizeResponsePayload(body, language))) as Response['json'];

  next();
};
