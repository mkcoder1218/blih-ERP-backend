
import type { Response } from 'express';

export const successResponse = (res: Response, data: any, message: string = "Success", statusCode: number = 200) => {
   res.status(statusCode).json({
      success: true,
      message,
      data,
      meta: {
         requestId: (res as any).locals.requestId
      }
   });
};

export const errorResponse = (res: Response, message: string, statusCode: number = 400, details?: any) => {
   res.status(statusCode).json({
      success: false,
      error: message,
      details,
      meta: {
         requestId: (res as any).locals.requestId
      }
   });
};

export const paginationResponse = (res: Response, data: any[], total: number, page: number, limit: number, message: string = "Success") => {
   res.status(200).json({
      success: true,
      message,
      data,
      meta: {
         total,
         page,
         limit,
         totalPages: Math.ceil(total / limit),
         requestId: (res as any).locals.requestId
      }
   });
};
