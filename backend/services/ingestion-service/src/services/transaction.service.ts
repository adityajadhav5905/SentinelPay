import { Transaction } from '../api/validators';
import { kafkaProducer } from '../kafka/producer';
import { entitlementService } from './entitlement.service';
import { PrismaClient, TransactionSource, prisma } from '@sentinelpay/database';

// Use shared Prisma client from backend


export class TransactionService {
    /**
     * Processes a single transaction:
     * 1. Check user entitlement
     * 2. Save to PostgreSQL
     * 3. Publish to Kafka
     */
    async processTransaction(
        transaction: Transaction,
        source: 'REALTIME_API' | 'BATCH_CSV'
    ): Promise<{ traceId: string; dbId: string }> {
        const effectiveUserId = transaction.userId || 'default-user';

        // 1. Entitlement Check
        const isEntitled = await entitlementService.checkEntitlement(effectiveUserId);
        if (!isEntitled) {
            throw new EntitlementError(`User ${effectiveUserId} is not entitled to submit transactions`);
        }

        // 2. Save to PostgreSQL
        const dbRecord = await prisma.transaction.create({
            data: {
                txId: transaction.txId,
                userId: effectiveUserId,
                endUserId: transaction.endUserId,
                amount: transaction.amount,
                currency: transaction.currency,
                timestamp: new Date(transaction.timestamp),
                location: transaction.location,
                merchant: transaction.merchant,
                category: transaction.category,
                source: source as TransactionSource,
            },
        });

        // 3. Publish to Kafka for ML processing
        const traceId = await kafkaProducer.publishTransaction(transaction, source, undefined);

        console.log(`✅ Transaction ${transaction.txId} processed: DB=${dbRecord.id}, Trace=${traceId}`);

        return { traceId, dbId: dbRecord.id };
    }
}

// Custom error for entitlement failures
export class EntitlementError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EntitlementError';
    }
}

export const transactionService = new TransactionService();
