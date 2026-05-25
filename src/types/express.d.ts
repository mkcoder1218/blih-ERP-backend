import "express";

export type AuthUser = {
  id: string;
  businessId: string;
  email: string;
  fullName: string;
  isPlatformSuperAdmin: boolean;
  roles: string[];
  permissions: string[];
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

