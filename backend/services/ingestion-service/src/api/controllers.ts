import { Request, Response } from 'express';
import crypto from 'crypto';

import { TransactionSchema } from './validators';
import { transactionService, EntitlementError } from '../services/transaction.service';
import { batchService } from '../services/batch.service';
import { prisma } from '@sentinelpay/database';

export const ingestTransaction = async (req: Request, res: Response) => {
    try {
        const validatedData = TransactionSchema.parse(req.body);

        // Override userId with authenticated user
        if (req.user && req.user.userId) {
            validatedData.userId = req.user.userId;
        } else {
            // Fallback for dev/test if no auth middleware (shouldn't happen with strict auth)
            // But we installed strict auth, so we should rely on it.
            // If req.user is missing, auth middleware failed or was bypassed.
            return res.status(401).json({ error: 'Unauthorized - User context missing' });
        }

        const result = await transactionService.processTransaction(validatedData, 'REALTIME_API');

        return res.status(202).json({
            status: 'accepted',
            message: 'Transaction received and published for processing',
            txId: validatedData.txId,
            traceId: result.traceId,
            dbId: result.dbId,
        });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation Error', details: error.errors });
        }
        if (error instanceof EntitlementError) {
            return res.status(403).json({ error: 'Forbidden', message: error.message });
        }
        console.error('Error handling transaction:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const ingestBatch = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No CSV file provided' });
        }

        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }

        // The file is saved by multer to req.file.path
        // uploadType defaults to BATCH_CSV for backward compatibility
        const uploadType = (req.body?.uploadType === 'PROFILE_HISTORY') ? 'PROFILE_HISTORY' : 'BATCH_CSV';
        console.log(`[DEBUG] Attempting upload for userId: ${userId}, file: ${req.file.originalname}, type: ${uploadType}`);
        const jobId = await batchService.addBatchJob(
            req.file.path,
            userId,
            req.file.originalname,
            uploadType as 'BATCH_CSV' | 'PROFILE_HISTORY'
        );

        return res.status(202).json({
            status: 'processing',
            jobId: jobId,
            uploadType,
            message: uploadType === 'PROFILE_HISTORY'
                ? 'File uploaded for profile building (no anomaly detection)'
                : 'File uploaded, processing started in background'
        });
    } catch (error: any) {
        if (error instanceof EntitlementError) {
            return res.status(403).json({ error: 'Forbidden', message: error.message });
        }
        console.error('Error handling batch upload:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getBatchHistory = async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string || req.user?.userId as string || req.query.userId as string;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized - userId required' });
        }

        const jobs = await prisma.batchJob.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        return res.json(jobs);
    } catch (error) {
        console.error('Error fetching batch history:', error);
        return res.status(500).json({ error: 'Failed to fetch batch history' });
    }
};

export const getBatchStatus = async (req: Request, res: Response) => {
    try {
        const jobId = req.params.id;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const job = await prisma.batchJob.findUnique({
            where: { id: jobId },
        });

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        return res.json(job);
    } catch (error) {
        console.error('Error fetching batch status:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const downloadBatchErrors = async (req: Request, res: Response) => {
    try {
        const jobId = req.params.id;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const job = await prisma.batchJob.findUnique({
            where: { id: jobId },
        });

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const errors = await prisma.batchError.findMany({
            where: { jobId },
            orderBy: { rowNumber: 'asc' }
        });

        if (errors.length === 0) {
            return res.status(404).json({ error: 'No errors found for this batch' });
        }

        const firstRowObj = JSON.parse(errors[0].rawData || '{}');
        const headers = Object.keys(firstRowObj);

        let csvContent = headers.join(',') + ',error_reason\n';

        for (const err of errors) {
            let rowObj: any = {};
            try {
                rowObj = JSON.parse(err.rawData || '{}');
            } catch (e) {
                // Fallback
            }
            const rowValues = headers.map(h => {
                const val = rowObj[h] || '';
                return `"${String(val).replace(/"/g, '""')}"`;
            });
            const errorMsg = `"${String(err.error).replace(/"/g, '""')}"`;
            csvContent += rowValues.join(',') + ',' + errorMsg + '\n';
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="failed_rows_${jobId}.csv"`);
        return res.status(200).send(csvContent);
    } catch (error) {
        console.error('Error downloading batch errors:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * API Key Management
 */

export const createApiKey = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Key name is required' });

        // Generate Key
        const secret = crypto.randomBytes(32).toString('hex');
        const prefix = 'sk_live';
        const apiKey = `${prefix}_${secret}`;
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        // Check limit
        const count = await prisma.apiKey.count({ where: { userId, isRevoked: false } });
        if (count >= 10) {
            return res.status(400).json({ error: 'API Key limit reached (max 10)' });
        }

        const newKey = await prisma.apiKey.create({
            data: {
                userId,
                name,
                keyPrefix: prefix,
                keyHash,
                scopes: ['ingest:write']
            }
        });

        // Return the RAW key once
        return res.status(201).json({
            id: newKey.id,
            name: newKey.name,
            apiKey: apiKey, // ONLY SHOWN HERE
            createdAt: newKey.createdAt
        });

    } catch (error) {
        console.error('Error creating API key:', error);
        res.status(500).json({ error: 'Failed to create API key' });
    }
};

export const listApiKeys = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const keys = await prisma.apiKey.findMany({
            where: { userId, isRevoked: false },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                keyPrefix: true,
                createdAt: true,
                lastUsedAt: true
            }
        });

        return res.json(keys);
    } catch (error) {
        console.error('Error listing API keys:', error);
        res.status(500).json({ error: 'Failed to list API keys' });
    }
};

export const revokeApiKey = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const keyId = req.params.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        await prisma.apiKey.updateMany({
            where: { id: keyId, userId }, // Ensure ownership
            data: { isRevoked: true }
        });

        return res.json({ message: 'API Key revoked' });
    } catch (error) {
        console.error('Error revoking API key:', error);
        res.status(500).json({ error: 'Failed to revoke API key' });
    }
};
