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
        }
    }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    // 1. Get Token from Header or Cookie
    let token = req.headers.authorization?.split(' ')[1];

    if (!token && req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized - No Token Provided' });
    }

    try {
        // 2. Verify Token
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'devforce-secret-key'
        ) as { userId: string; email: string; role: string };

        // 3. Attach User to Request
        req.user = decoded;
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
