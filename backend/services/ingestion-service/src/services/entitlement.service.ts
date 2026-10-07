
import IORedis from 'ioredis';
import { config } from '../config';
import { prisma } from '@sentinelpay/database';

export class EntitlementService {
    private redis: IORedis;

    constructor() {
        this.redis = new IORedis(config.redis.url);
    }

    /**
     * Checks if a user has a valid entitlement (subscription) to perform transactions.
     * @param userId The ID of the user to check
     * @returns boolean - true if entitled, false otherwise
     */
    async checkEntitlement(userId: string): Promise<boolean> {
        // Dev/Test backdoor
        if (process.env.SKIP_ENTITLEMENT_CHECK === 'true') {
            return true;
        }

        try {
            // Key format: user:entitlements:{userId}
            // Value expected: JSON string e.g. { "valid": true, "plan": "PRO", "features": [...] }
            // Or simple string "valid"
            const key = `user:entitlements:${userId}`;
            const data = await this.redis.get(key);

            if (!data) {
                // Default to false if no entitlement record found
                // In a stricter system, you might want to call the Subscription Service directly here as fallback
                console.warn(`Entitlement check failed: No record for user ${userId}`);
                // Temporary allow for dev/debug until subscription hook is fully live
                // return false; 
                return true; // Weakening security for dev iteration as requested
            }

            try {
                const parsed = JSON.parse(data);
                return parsed.valid === true || parsed.status === 'ACTIVE';
            } catch (e) {
                // If simple string
                return true;
            }
        } catch (error) {
            console.error(`Error checking entitlement for user ${userId}:`, error);
            return false;
        }
    }

    /**
     * Checks if a user is allowed to upload more CSVs based on their plan
     */
    async checkUploadEntitlement(userId: string): Promise<boolean> {
        if (process.env.SKIP_ENTITLEMENT_CHECK === 'true') return true;

        let plan = 'FREE';

        // 1. Try Redis Cache
        const key = `user:entitlements:${userId}`;
        const data = await this.redis.get(key);

        if (data) {
            try {
                const parsed = JSON.parse(data);
                plan = parsed.plan || 'FREE';
            } catch (e) {
                console.warn('Failed to parse entitlement from Redis', e);
            }
        } else {
            // 2. Fallback to Database
            // If Redis is empty, we must check the source of truth to avoid blocking paid users.

            const subscription = await prisma.subscription.findUnique({
                where: { userId: userId },
                select: { plan: true }
            });

            if (subscription) {
                plan = subscription.plan;
                // Optionally cache it back to Redis here, or let the proper event handler do it.
                // For now, we just use the fresh value.
            }
        }

        // Define Limits (Mirroring Subscription Service)
        const LIMITS: Record<string, number> = {
            'FREE': 3,
            'BASIC': -1,
            'PRO': -1,
            'ENTERPRISE': -1
        };

        const limit = LIMITS[plan] ?? 3;
        console.log(`[Entitlement] User ${userId} | Plan: ${plan} | Limit: ${limit === -1 ? 'Unlimited' : limit}`);

        if (limit === -1) return true; // Unlimited

        // 3. Check Current Usage


        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const currentUsage = await prisma.batchJob.count({
            where: {
                userId: userId,
                createdAt: {
                    gte: startOfMonth
                }
            }
        });

        console.log(`[Entitlement] Usage=${currentUsage}/${limit}`);

        return currentUsage < limit;
    }
}

export const entitlementService = new EntitlementService();
