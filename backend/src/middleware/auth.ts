import { Request, Response, NextFunction } from 'express';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { AppDataSource } from '../config/database';
import { User } from '../models/User';

// Extend Express Request type to include user and auth
declare global {
  namespace Express {
    interface Request {
      user?: User;
      auth?: {
        userId: string;
        sessionId: string;
      };
    }
  }
}

// Clerk authentication middleware
export const requireAuth = ClerkExpressRequireAuth({
  // Optional configuration
  onError: (err: Error) => {
    console.error('Clerk authentication error:', err);
  }
});

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
  return async (req: Request, res: Response, next: NextFunction) => {
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