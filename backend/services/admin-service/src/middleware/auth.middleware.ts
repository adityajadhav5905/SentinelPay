import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                email: string;
                role: string;
            };
            auth?: {
                userId: string;
            };
        }
    }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized - No Token Provided' });
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'devforce-secret-key'
        ) as { userId: string; email: string; role: string };

        req.user = decoded;
        req.auth = { userId: decoded.userId };
        next();
    } catch (error) {
        console.error('❌ Auth Error:', error);
        return res.status(401).json({ error: 'Unauthorized - Invalid Token' });
    }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, () => {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Forbidden - Admins Only' });
        }
        next();
    });
};
