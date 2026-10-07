import { Request, Response } from 'express';
import { prisma, SubscriptionPlan, SubscriptionStatus } from '@sentinelpay/database';

// Plan definitions with features
const PLANS = [
    {
        name: 'Free',
        price: 'Free',
        priceValue: 0,
        features: [
            { name: 'Batch Ingestion', included: true },
            { name: 'Basic Anomaly Detection', included: true },
            { name: 'Live Tracking', included: false },
            { name: 'Advanced ML Models', included: false },
            { name: 'Email Alerts', included: false },
        ],
        limits: {
            transactionsPerMonth: 5000,
            csvUploadsPerMonth: 3,
            retentionDays: 7,
            alertsEnabled: false
        }
    },
    {
        name: 'Basic',
        price: '₹29/mo',
        priceValue: 2900,
        features: [
            { name: 'Batch Ingestion', included: true },
            { name: 'Basic Anomaly Detection', included: true },
            { name: 'Live Tracking', included: false },
            { name: 'Advanced ML Models', included: true },
            { name: 'Email Alerts', included: true },
        ],
        limits: {
            transactionsPerMonth: -1, // Unlimited
            csvUploadsPerMonth: -1,   // Unlimited
            retentionDays: 30,
            alertsEnabled: true
        }
    },
    {
        name: 'Pro',
        price: '₹99/mo',
        priceValue: 9900,
        features: [
            { name: 'Batch Ingestion', included: true },
            { name: 'Basic Anomaly Detection', included: true },
            { name: 'Live Tracking', included: true },
            { name: 'Advanced ML Models', included: true },
            { name: 'Email Alerts', included: true },
        ],
        limits: {
            transactionsPerMonth: -1, // Unlimited
            csvUploadsPerMonth: -1,   // Unlimited
            retentionDays: 90,
            alertsEnabled: true
        }
    },
    {
        name: 'Enterprise',
        price: 'Custom',
        priceValue: null,
        features: [
            { name: 'Batch Ingestion', included: true },
            { name: 'Basic Anomaly Detection', included: true },
            { name: 'Live Tracking', included: true },
            { name: 'Advanced ML Models', included: true },
            { name: 'Priority Support', included: true },
        ],
        limits: {
            transactionsPerMonth: -1, // Unlimited
            csvUploadsPerMonth: -1,   // Unlimited
            retentionDays: 365,
            alertsEnabled: true
        }
    }
];

/**
 * Get current user's subscription and entitlements
 * GET /subscriptions/me
 */
export const getMySubscription = async (req: Request, res: Response) => {
    try {
        // Get user ID from auth middleware or query param (for testing)
        const userId = (req as any).auth?.userId || req.query.userId as string;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized - userId required' });
        }

        // Query subscription from database
        const subscription = await prisma.subscription.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        let planName = 'Free';
        let status = 'Active';

        if (subscription) {
            // Map Enum back to Display Name
            const enumMap: Record<string, string> = {
                'FREE': 'Free',
                'BASIC': 'Basic',
                'PRO': 'Pro',
                'ENTERPRISE': 'Enterprise'
            };
            planName = enumMap[subscription.plan] || 'Free';
            status = subscription.status === 'ACTIVE' ? 'Active' : subscription.status;
        }

        const plan = PLANS.find(p => p.name === planName) || PLANS[0];

        // Get usage stats for current month
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

        // 1. Transactions count
        const txCurrent = await prisma.transaction.count({
            where: {
                userId,
                ingestedAt: { gte: startOfMonth }
            }
        });

        // 2. CSV Uploads count
        const uploadCurrent = await prisma.batchJob.count({
            where: {
                userId,
                createdAt: { gte: startOfMonth }
            }
        });

        res.json({
            plan: plan.name,
            status: status,
            billingCycle: 'monthly',
            usage: {
                transactions: {
                    current: txCurrent,
                    limit: plan.limits.transactionsPerMonth
                },
                uploads: {
                    current: uploadCurrent,
                    limit: plan.limits.csvUploadsPerMonth
                }
            }
        });
    } catch (error) {
        console.error('Error fetching subscription:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
};

/**
 * Get available subscription plans
 * GET /subscriptions/plans
 */
export const getPlans = async (req: Request, res: Response) => {
    try {
        res.json(PLANS.map(plan => ({
            name: plan.name,
            price: plan.price,
            features: plan.features
        })));
    } catch (error) {
        console.error('Error fetching plans:', error);
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
};
