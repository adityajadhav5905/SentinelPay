import { Request, Response } from 'express';
import { prisma } from '@sentinelpay/database';

export const getSystemStats = async (req: Request, res: Response) => {
    try {
        // 1. User Stats
        const totalUsers = await prisma.user.count();
        const activeUsers = await prisma.user.count({
            where: {
                transactions: { some: { timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } } // Active in last 30 days
            }
        });

        // 2. Subscription Stats (MRR Approximation)
        const subscriptions = await prisma.subscription.findMany({
            where: { status: 'ACTIVE' }
        });

        let mrr = 0;
        const planPrices: Record<string, number> = {
            'FREE': 0,
            'BASIC': 29,
            'PRO': 99,
            'ENTERPRISE': 299 // Placeholder avg
        };

        subscriptions.forEach((sub: { plan: string }) => {
            mrr += planPrices[sub.plan] || 0;
        });

        // 3. Transaction Stats
        const totalTransactions = await prisma.transaction.count();
        const anomalyCount = await prisma.anomaly.count();

        // 4. Infrastructure Health
        let dbHealth = 'DOWN';
        try {
            await prisma.$queryRaw`SELECT 1`;
            dbHealth = 'HEALTHY';
        } catch (e) {
            console.error('DB Health Check Failed:', e);
        }

        let redisHealth = 'DOWN';
        try {
            if (process.env.REDIS_URL) {
                const { Redis } = require('ioredis');
                const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, commandTimeout: 2000 });
                await redis.ping();
                redisHealth = 'HEALTHY';
                redis.disconnect();
            } else {
                redisHealth = 'UNKNOWN';
            }
        } catch (e) {
            console.error('Redis Health Check Failed:', e);
        }

        let kafkaHealth = 'DOWN';
        try {
            if (process.env.KAFKA_BOOTSTRAP_SERVERS) {
                const { Kafka } = require('kafkajs');
                const kafka = new Kafka({
                    clientId: 'admin-health-check',
                    brokers: process.env.KAFKA_BOOTSTRAP_SERVERS.split(','),
                    connectionTimeout: 2000
                });
                const admin = kafka.admin();
                await admin.connect();
                await admin.listTopics();
                kafkaHealth = 'HEALTHY';
                await admin.disconnect();
            } else {
                kafkaHealth = 'UNKNOWN';
            }
        } catch (e) {
            console.error('Kafka Health Check Failed:', e);
        }

        const components = { db: dbHealth, redis: redisHealth, kafka: kafkaHealth };
        const systemHealth = Object.values(components).includes('DOWN') ? 'DEGRADED' : 'HEALTHY';

        res.json({
            users: {
                total: totalUsers,
                active: activeUsers,
                newThisMonth: await prisma.user.count({
                    where: { createdAt: { gte: new Date(new Date().setDate(1)) } }
                })
            },
            revenue: {
                mrr: mrr,
                currency: 'INR'
            },
            activity: {
                transactions: totalTransactions,
                anomalies: anomalyCount,
                anomalyRate: totalTransactions > 0 ? ((anomalyCount / totalTransactions) * 100).toFixed(2) + '%' : '0%'
            },
            system: {
                health: systemHealth,
                components,
                version: '1.2.0'
            }
        });

    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
};

export const getChartData = async (req: Request, res: Response) => {
    try {
        // Get last 7 days of data
        const days = 7;
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const trafficData = [];
        const userAcquisition = [];

        for (let i = days - 1; i >= 0; i--) {
            const startOfDay = new Date();
            startOfDay.setDate(startOfDay.getDate() - i);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(startOfDay);
            endOfDay.setHours(23, 59, 59, 999);

            const dayName = dayNames[startOfDay.getDay()];

            // Transaction count for that day
            const txCount = await prisma.transaction.count({
                where: {
                    timestamp: { gte: startOfDay, lte: endOfDay }
                }
            });

            // Anomaly count for that day
            const anomalyCount = await prisma.anomaly.count({
                where: {
                    detectedAt: { gte: startOfDay, lte: endOfDay }
                }
            });

            // New users for that day
            const newUsers = await prisma.user.count({
                where: {
                    createdAt: { gte: startOfDay, lte: endOfDay }
                }
            });

            trafficData.push({
                name: dayName,
                transactions: txCount,
                anomalies: anomalyCount
            });

            userAcquisition.push({
                name: dayName,
                newUsers: newUsers
            });
        }

        res.json({
            trafficData,
            userAcquisition
        });

    } catch (error) {
        console.error('Chart Data Error:', error);
        res.status(500).json({ error: 'Failed to fetch chart data' });
    }
};
