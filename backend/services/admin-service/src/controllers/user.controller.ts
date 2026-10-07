import { Request, Response } from 'express';
import { prisma } from '@sentinelpay/database';

export const listUsers = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = req.query.search as string;

        const where: any = {};
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { subscription: true }
            }),
            prisma.user.count({ where })
        ]);

        res.json({
            data: users,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('List Users Error:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
};

export const updateUserRole = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['USER', 'ADMIN'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = await prisma.user.update({
            where: { id },
            data: { role }
        });

        res.json({ message: 'User role updated', user });
    } catch (error) {
        console.error('Update Role Error:', error);
        res.status(500).json({ error: 'Failed to update role' });
    }
};

export const updateUserStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['ACTIVE', 'SUSPENDED', 'BANNED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be ACTIVE, SUSPENDED, or BANNED.' });
        }

        const user = await prisma.user.update({
            where: { id },
            data: { accountStatus: status }
        });

        res.json({ message: `User account status updated to ${status}`, user });
    } catch (error) {
        console.error('Update Status Error:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
};

export const forcePasswordReset = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { forceReset } = req.body; // boolean

        if (typeof forceReset !== 'boolean') {
            return res.status(400).json({ error: 'forceReset must be a boolean' });
        }

        // Check if user is an OAuth user
        const existingUser = await prisma.user.findUnique({ where: { id } });
        if (!existingUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (forceReset && !existingUser.password && existingUser.googleId) {
            return res.status(400).json({ error: 'Cannot force password reset for Google OAuth users' });
        }

        const user = await prisma.user.update({
            where: { id },
            data: { forcePasswordReset: forceReset }
        });

        res.json({ message: `User forced password reset set to ${forceReset}`, user });
    } catch (error) {
        console.error('Force Reset Error:', error);
        res.status(500).json({ error: 'Failed to update force password reset flag' });
    }
};

export const updateUserSubscription = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { plan, status } = req.body;

        if (!['FREE', 'BASIC', 'PRO', 'ENTERPRISE'].includes(plan)) {
            return res.status(400).json({ error: 'Invalid subscription plan' });
        }

        const validStatuses = ['ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'HALTED', 'TRIALING'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid subscription status' });
        }

        const updateData: any = { plan };
        if (status) updateData.status = status;

        const subscription = await prisma.subscription.update({
            where: { userId: id },
            data: updateData
        });

        res.json({ message: `User subscription updated to ${plan}`, subscription });
    } catch (error) {
        console.error('Update Subscription Error:', error);
        res.status(500).json({ error: 'Failed to update user subscription' });
    }
};
