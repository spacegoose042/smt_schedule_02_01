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
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  console.log('Auth middleware called for path:', req.path);
  console.log('Request headers:', {
    authorization: req.headers.authorization,
    'user-agent': req.headers['user-agent'],
    host: req.headers.host,
    origin: req.headers.origin
  });
  
  const clerkAuth = ClerkExpressRequireAuth();
  return clerkAuth(req, res, (err) => {
    if (err) {
      console.error('Auth error:', {
        message: err.message,
        name: err.name,
        stack: err.stack
      });
      return res.status(401).json({ message: 'Unauthorized', error: err.message });
    }
    console.log('Auth successful for user:', req.auth?.userId);
    next();
  });
};

// Middleware to attach user info
export const attachUserInfo = (req: Request, res: Response, next: NextFunction) => {
  if (req.auth?.userId) {
    console.log('Attaching user info for:', req.auth.userId);
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
        return res.status(401).json({ message: 'User information not available' });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      console.error('Error in role check:', error);
      next(error);
    }
  };
}; 