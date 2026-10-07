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

import { prisma } from '@sentinelpay/database';
import crypto from 'crypto';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // 1. Check API Key first
        const apiKey = req.headers['x-api-key'] as string;
        if (apiKey) {
            const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

            // Find key in DB
            const validKey = await prisma.apiKey.findFirst({
                where: {
                    keyHash,
                    isRevoked: false,
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: new Date() } }
                    ]
                },
                include: { user: true }
            });

            if (validKey) {
                // Update last used
                await prisma.apiKey.update({
                    where: { id: validKey.id },
                    data: { lastUsedAt: new Date() }
                });

                req.auth = { userId: validKey.userId };
                // Optionally set req.user if needed by controllers
                req.user = {
                    userId: validKey.userId,
                    email: validKey.user.email,
                    role: validKey.user.role
                };
                return next();
            } else {
                return res.status(401).json({ error: 'Unauthorized - Invalid API Key' });
            }
        }

        // 2. Fallback to JWT
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized - No Token Provided' });
        }

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
