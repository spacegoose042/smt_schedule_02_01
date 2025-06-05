import { Request, Response, NextFunction } from 'express';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { AppDataSource } from '../config/database';
import { User } from '../models/User';

// Initialize Clerk with the secret key
if (!process.env.CLERK_SECRET_KEY) {
  throw new Error('CLERK_SECRET_KEY is not set in environment variables');
}

// Add user type to Express Request
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionClaims?: {
          email?: string;
          firstName?: string;
          lastName?: string;
          metadata?: {
            role?: string;
          };
        };
      };
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
      };
    }
  }
}

// Authentication middleware
export const requireAuth = ClerkExpressRequireAuth();

// Middleware to attach user info
export const attachUserInfo = (req: Request, res: Response, next: NextFunction) => {
  if (req.auth?.userId) {
    req.user = {
      id: req.auth.userId,
      email: req.auth.sessionClaims?.email || '',
      firstName: req.auth.sessionClaims?.firstName || '',
      lastName: req.auth.sessionClaims?.lastName || '',
      role: req.auth.sessionClaims?.metadata?.role || 'viewer'
    };
  }
  next();
};

// Middleware to attach user from database
export const attachUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      return next();
    }

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { clerkId: clerkUserId }
    });

    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    console.error('Error attaching user:', error);
    next(error);
  }
};

// Role-based authorization middleware
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized - User not found' });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden - Insufficient permissions' });
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({ message: 'Internal server error during authorization' });
    }
  };
}; 