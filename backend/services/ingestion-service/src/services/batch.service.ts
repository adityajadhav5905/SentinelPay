import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config';
import fs from 'fs';
import csv from 'csv-parser';
import { TransactionSchema, Transaction } from '../api/validators';
import { kafkaProducer } from '../kafka/producer';
import { entitlementService } from './entitlement.service';
import { EntitlementError } from './transaction.service';
import { PrismaClient, TransactionSource, prisma } from '@sentinelpay/database';
import axios from 'axios';


const BATCH_QUEUE_NAME = 'csv-processing';

interface BatchJobData {
    filePath: string;
    userId: string;
    filename: string;
    dbJobId: string;
    uploadType: 'BATCH_CSV' | 'PROFILE_HISTORY';
}

interface MLTransaction {
    tx_id?: string;
    amount: number;
    timestamp: string;
    merchant?: string;
    category?: string;
    location?: string;
}

export class BatchService {
    private queue: Queue;
    private worker: Worker;

    constructor() {
        this.queue = new Queue(BATCH_QUEUE_NAME, {
            connection: {
                url: config.redis.url,
            },
        });

        // Initialize Worker
        this.worker = new Worker(BATCH_QUEUE_NAME, async (job: Job<BatchJobData>) => {
            await this.processJob(job);
        }, {
            connection: {
                url: config.redis.url,
            },
            concurrency: 5,
        });

        this.worker.on('completed', (job: Job | undefined) => {
            console.log(`✅ Batch Job ${job?.id} completed`);
        });

        this.worker.on('failed', (job: Job | undefined, err: Error) => {
            console.error(`❌ Batch Job ${job?.id} failed: ${err.message}`);
        });
    }

    /**
     * Adds a batch processing job to the queue
     */
    async addBatchJob(filePath: string, userId: string, filename: string, uploadType: 'BATCH_CSV' | 'PROFILE_HISTORY' = 'BATCH_CSV'): Promise<string> {
        // 1. Check entitlement first
        const isEntitled = await entitlementService.checkEntitlement(userId);
        if (!isEntitled) {
            // Clean up file since we won't process it
            fs.unlink(filePath, (err: any) => { });
            throw new EntitlementError(`User ${userId} is not entitled to submit batch jobs`);
        }

        // 1.1 Check upload limit
        const canUpload = await entitlementService.checkUploadEntitlement(userId);
        if (!canUpload) {
            fs.unlink(filePath, (err: any) => { });
            throw new EntitlementError(`User ${userId} has reached their monthly upload limit. Please upgrade your plan.`);
        }

        // 2. Create BatchJob record in DB
        const dbJob = await prisma.batchJob.create({
            data: {
                userId: userId,
                filename: filename,
                r2Key: filePath, // Using local path for now
                status: 'PENDING',
            },
        });

        // 3. Add to BullMQ queue
        const job = await this.queue.add('process-csv', {
            filePath,
            userId,
            filename,
            dbJobId: dbJob.id,
            uploadType,
        });

        // 4. Update status to PROCESSING
        await prisma.batchJob.update({
            where: { id: dbJob.id },
            data: { status: 'PROCESSING', startedAt: new Date() },
        });

        return dbJob.id;
    }

    private async processJob(job: Job<BatchJobData>): Promise<void> {
        const { filePath, userId, dbJobId, uploadType } = job.data;
        const isProfileHistory = uploadType === 'PROFILE_HISTORY';

        if (!fs.existsSync(filePath)) {
            await this.failJob(dbJobId, `File not found: ${filePath}`);
            throw new Error(`File not found: ${filePath}`);
        }

        const profile = await prisma.userBehaviorProfile.findUnique({ where: { userId } });
        const isNewProfile = profile?.profileStatus === 'NEW' && profile?.totalTransactions === 0;

        let totalRows = 0;
        let processedRows = 0;
        let failedRows = 0;
        const profileTransactions: MLTransaction[] = [];
        const seenTxIds = new Set<string>();

        try {
            const stream = fs.createReadStream(filePath).pipe(csv());

            for await (const row of stream) {
                totalRows++;
                try {
                    const txId = row.txId || row.tx_id || row.id || row.Id || row.ID;
                    if (!txId) {
                        throw new Error("Missing transaction ID");
                    }
                    if (seenTxIds.has(txId)) {
                        throw new Error(`Duplicate transaction ID in file: ${txId}`);
                    }
                    seenTxIds.add(txId);

                    const rawTx = {
                        txId: txId,
                        amount: parseFloat(row.amount),
                        currency: row.currency || 'USD',
                        userId: userId,
                        merchant: row.merchant,
                        timestamp: row.timestamp || row.Timestamp || row.date || row.Date || row.time || row.Time || new Date().toISOString(),
                        location: row.location,
                        category: row.category,
                    };

                    // Validate
                    const transaction = TransactionSchema.parse(rawTx);
                    const effectiveUserId = transaction.userId || 'default-user';

                    if (isProfileHistory) {
                        // For PROFILE_HISTORY: Accumulate in memory, DO NOT save to DB
                        profileTransactions.push({
                            amount: transaction.amount,
                            timestamp: transaction.timestamp,
                            merchant: transaction.merchant,
                            category: transaction.category,
                            location: transaction.location
                        });
                    } else if (isNewProfile) {
                        // For NEW profile BATCH: Save to DB but DO NOT publish immediately
                        await prisma.transaction.upsert({
                            where: {
                                txId_userId: {
                                    txId: transaction.txId,
                                    userId: effectiveUserId,
                                },
                            },
                            update: {
                                batchId: dbJobId,
                                amount: transaction.amount,
                                currency: transaction.currency,
                                timestamp: new Date(transaction.timestamp),
                                location: transaction.location,
                                merchant: transaction.merchant,
                                category: transaction.category,
                            },
                            create: {
                                txId: transaction.txId,
                                userId: effectiveUserId,
                                amount: transaction.amount,
                                currency: transaction.currency,
                                timestamp: new Date(transaction.timestamp),
                                location: transaction.location,
                                merchant: transaction.merchant,
                                category: transaction.category,
                                source: 'BATCH_CSV',
                                batchId: dbJobId,
                            },
                        });
                        profileTransactions.push({
                            tx_id: transaction.txId,
                            amount: transaction.amount,
                            timestamp: transaction.timestamp,
                            merchant: transaction.merchant,
                            category: transaction.category,
                            location: transaction.location
                        });
                    } else {
                        // For normal BATCH_CSV: Save to DB and publish to Kafka
                        await prisma.transaction.upsert({
                            where: {
                                txId_userId: {
                                    txId: transaction.txId,
                                    userId: effectiveUserId,
                                },
                            },
                            update: {
                                batchId: dbJobId,
                                amount: transaction.amount,
                                currency: transaction.currency,
                                timestamp: new Date(transaction.timestamp),
                                location: transaction.location,
                                merchant: transaction.merchant,
                                category: transaction.category,
                            },
                            create: {
                                txId: transaction.txId,
                                userId: effectiveUserId,
                                amount: transaction.amount,
                                currency: transaction.currency,
                                timestamp: new Date(transaction.timestamp),
                                location: transaction.location,
                                merchant: transaction.merchant,
                                category: transaction.category,
                                source: 'BATCH_CSV',
                                batchId: dbJobId,
                            },
                        });

                        // Publish to Kafka for anomaly detection
                        await kafkaProducer.publishTransaction(transaction, 'BATCH_CSV', dbJobId);
                    }
                    processedRows++;
                } catch (err: any) {
                    failedRows++;
                    // Log error to BatchError table
                    await prisma.batchError.create({
                        data: {
                            jobId: dbJobId,
                            rowNumber: totalRows,
                            error: err.message || 'Unknown error',
                            rawData: JSON.stringify(row),
                        },
                    });
                }
            }

            // Update job status after all rows are processed
            await prisma.batchJob.update({
                where: { id: dbJobId },
                data: {
                    status: failedRows === totalRows && totalRows > 0 ? 'FAILED' : 'COMPLETED',
                    totalRows,
                    processedRows,
                    failedRows,
                    completedAt: new Date(),
                },
            });

            console.log(`Batch ${dbJobId}: Total=${totalRows}, Success=${processedRows}, Failed=${failedRows}, Type=${uploadType}`);

            // For PROFILE_HISTORY or NEW profile uploads, send accumulated transactions to ML service
            if ((isProfileHistory || isNewProfile) && profileTransactions.length > 0) {
                try {
                    // @ts-ignore
                    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';

                    if (isNewProfile && profileTransactions.length >= 30) {
                        console.log(`Sending ${profileTransactions.length} transactions to ML service for split-batch detection...`);
                        await axios.post(`${mlServiceUrl}/v1/profile/${userId}/batch-detect`, {
                            transactions: profileTransactions,
                            batch_id: dbJobId
                        });
                        console.log(`✅ Batch-detect triggered for user ${userId}`);
                    } else {
                        console.log(`Sending ${profileTransactions.length} transactions to ML service for profile build...`);
                        await axios.post(`${mlServiceUrl}/v1/profile/${userId}/rebuild`, {
                            transactions: profileTransactions
                        });
                        console.log(`✅ Profile build triggered for user ${userId}`);
                    }
                } catch (err: any) {
                    console.warn(`⚠️ ML Service trigger failed: ${err.message}`);
                    if (axios.isAxiosError(err) && err.response) {
                        console.warn(`ML Service Error Response: ${JSON.stringify(err.response.data)}`);
                    }
                }
            } else if (!isProfileHistory && !isNewProfile && processedRows > 0) {
                // For regular BATCH_CSV uploads from existing users, rebuild profile from ALL DB transactions
                // This ensures the behavioral profile bar updates after every upload
                try {
                    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
                    console.log(`Triggering profile rebuild from DB for user ${userId}...`);
                    await axios.post(`${mlServiceUrl}/v1/profile/${userId}/rebuild-from-db`);
                    console.log(`✅ Profile rebuild from DB triggered for user ${userId}`);
                } catch (err: any) {
                    console.warn(`⚠️ Profile rebuild trigger failed: ${err.message}`);
                }
            }

            // Report batch issues if any rows failed
            if (failedRows > 0) {
                try {
                    console.log(`Fetching failed rows for batch ${dbJobId} to send email...`);
                    const errors = await prisma.batchError.findMany({
                        where: { jobId: dbJobId },
                        orderBy: { rowNumber: 'asc' }
                    });

                    if (errors.length > 0) {
                        // Reconstruct CSV based on the first rawData keys
                        const firstRowObj = JSON.parse(errors[0].rawData || '{}');
                        const headers = Object.keys(firstRowObj);

                        let csvContent = headers.join(',') + ',error_reason\n';

                        for (const err of errors) {
                            let rowObj: any = {};
                            try {
                                rowObj = JSON.parse(err.rawData || '{}');
                            } catch (e) {
                                // Fallback if rawData is not valid JSON
                            }
                            const rowValues = headers.map(h => {
                                const val = rowObj[h] || '';
                                return `"${String(val).replace(/"/g, '""')}"`;
                            });
                            const errorMsg = `"${String(err.error).replace(/"/g, '""')}"`;
                            csvContent += rowValues.join(',') + ',' + errorMsg + '\n';
                        }

                        // @ts-ignore
                        const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3001';
                        await axios.post(`${notificationServiceUrl}/v1/notifications/internal/batch-issues`, {
                            userId,
                            failedRows,
                            csvContent
                        });
                        console.log(`✅ Triggered batch issues email for user ${userId} (${failedRows} failed rows)`);
                    }
                } catch (err: any) {
                    console.warn(`⚠️ Failed to send batch issues email: ${err.message}`);
                }
            }

            // Clean up file
            fs.unlink(filePath, (err: any) => {
                if (err) console.error('Failed to delete temp file:', err);
            });

        } catch (error: any) {
            console.error(`Fatal error processing batch ${dbJobId}:`, error);
            await this.failJob(dbJobId, error.message);
            // Ensure cleanup
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, (err: any) => { });
            }
            throw error;
        }
    }

    private async failJob(dbJobId: string, error: string): Promise<void> {
        await prisma.batchJob.update({
            where: { id: dbJobId },
            data: {
                status: 'FAILED',
                completedAt: new Date(),
            },
        });
    }
}

export const batchService = new BatchService();
