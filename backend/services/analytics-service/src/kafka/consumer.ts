import { Kafka, EachMessagePayload, CompressionTypes, CompressionCodecs } from 'kafkajs';
import { SnappyCodec } from 'kafkajs-snappy';
import { prisma } from '@sentinelpay/database';
import { sseManager } from '../services/sse.service';

// Register Snappy codec
CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;

const KAFKA_BROKERS = (process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092').split(',');
const CLIENT_ID = process.env.SERVICE_NAME || 'analytics-service';
const GROUP_ID = `${CLIENT_ID}-group`;

export const startKafkaConsumer = async () => {
    const kafka = new Kafka({
        clientId: CLIENT_ID,
        brokers: KAFKA_BROKERS,
        retry: {
            initialRetryTime: 100,
            retries: 8
        }
    });

    const consumer = kafka.consumer({ groupId: GROUP_ID });

    try {
        await consumer.connect();
        console.log(`✅ [${CLIENT_ID}] Kafka Consumer connected`);

        // Subscribe to relevant topics
        await consumer.subscribe({ topics: ['transactions', 'anomalies'], fromBeginning: true });
        console.log(`✅ [${CLIENT_ID}] Subscribed to topics: transactions, anomalies`);

        await consumer.run({
            eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
                const prefix = `[${CLIENT_ID}]`;
                if (!message.value) return;

                const payload = message.value.toString();

                try {
                    const event = JSON.parse(payload);

                    try {
                        if (topic === 'transactions') {
                            await handleTransactionEvent(event);
                        } else if (topic === 'anomalies') {
                            await handleAnomalyEvent(event);
                        }
                    } catch (processingError) {
                        console.error(`${prefix} ❌ Error processing message logic on ${topic}:`, processingError);
                        // Do NOT rethrow. Log and continue to next message.
                        // This prevents a "poison pill" message from crashing the service repeatedly.
                    }

                } catch (e) {
                    console.error(`${prefix} ❌ Critical Error or JSON Parse Error on ${topic}:`, e);
                    // Also catch JSON parse errors so they don't crash the consumer
                }
            },
        });
    } catch (error) {
        console.error(`❌ [${CLIENT_ID}] Failed to start consumer:`, error);
        // Retry logic instead of immediate exit could be better, but for Docker restart policy, exit is fine.
        // However, let's log more details.
        if (error instanceof Error) {
            console.error(error.stack);
        }
        process.exit(1);
    }
};

async function handleTransactionEvent(event: any) {
    const { meta, data } = event;

    // 1. Ensure User ID exists (Basic check)
    if (!meta.user_id) {
        throw new Error('Transaction missing user_id in metadata');
    }

    // 2. Check for User existence (Optional but helps debug FK errors)
    // We try to find the user. If they don't exist, we might be ahead of Auth service.
    // In a strict consistency model, we should retry.
    // For now, let's rely on FK constraint to throw, which we catch and rethrow above.

    // 3. Idempotency Check
    const existing = await prisma.transaction.findUnique({
        where: { txId_userId: { txId: data.tx_id, userId: meta.user_id } }
    });

    if (existing) {
        console.warn(`⚠️ [Analytics] Duplicate transaction ${data.tx_id} found.`);

        // Update batchId to link it to the new upload
        if (meta.batch_id) {
            try {
                // Link transaction to new batch
                if (existing.batchId !== meta.batch_id) {
                    await prisma.transaction.update({
                        where: { id: existing.id },
                        data: { batchId: meta.batch_id }
                    });
                    console.log(`✅ [Analytics] Linked duplicate transaction ${data.tx_id} to batch ${meta.batch_id}`);
                }

                // CRITICAL FIX: Increment analyzedRows even for duplicates
                await prisma.batchJob.update({
                    where: { id: meta.batch_id },
                    data: {
                        analyzedRows: { increment: 1 }
                    }
                });
            } catch (err) {
                console.warn(`⚠️ [Analytics] Failed to update batch progress (duplicate) for ${meta.batch_id}`, err);
            }
        }
        return;
    }

    // 4. Create Transaction
    try {
        await prisma.transaction.create({
            data: {
                txId: data.tx_id,
                userId: meta.user_id,
                amount: data.amount,
                currency: data.currency,
                endUserId: meta.end_user_id || null, // Handle undefined
                timestamp: new Date(meta.timestamp),
                location: data.location,
                merchant: data.merchant,
                category: data.category,
                source: meta.source === 'BATCH_CSV' ? 'BATCH_CSV' : 'REALTIME_API',
                batchId: meta.batch_id || null
            }
        });
        // 5. Update Batch Job Progress
        if (meta.batch_id) {
            try {
                await prisma.batchJob.update({
                    where: { id: meta.batch_id },
                    data: {
                        analyzedRows: { increment: 1 }
                    }
                });
            } catch (err) {
                console.warn(`⚠️ [Analytics] Failed to update batch progress for ${meta.batch_id}`, err);
            }
        }

        console.log(`✅ [Analytics] Persisted Transaction: ${data.tx_id}`);
    } catch (error: any) {
        if (error.code === 'P2003') {
            console.warn(`⚠️ [Analytics] Skipping transaction ${data.tx_id} for non-existent user ${meta.user_id}`);
            return; // Skip message, don't crash
        }
        // Log but don't rethrow to avoid crashing the consumer loop
        console.error(`❌ [Analytics] Error persisting transaction ${data.tx_id}:`, error);
    }
}

async function handleAnomalyEvent(event: any) {
    const { meta, data, analysis, verdict } = event;
    const txId = data.tx_id || data.txId;

    // 1. Idempotency Check
    // We check if we already have an anomaly for this transaction
    const existing = await prisma.anomaly.findFirst({
        where: { transaction: { txId: txId } }
    });
    if (existing) return;

    // 2. Find internal Transaction ID
    const tx = await prisma.transaction.findFirst({
        where: { txId: txId, userId: meta.user_id }
    });

    if (!tx) {
        // RACE CONDITION HANDLING
        // Transaction might not be persisted yet. Throw error to force retry.
        console.warn(`⏳ [Analytics] Transaction ${txId} not found for anomaly. Retrying...`);
        throw new Error(`Transaction ${txId} not found. Retrying...`);
    }

    // 3. Create Anomaly
    const newAnomaly = await prisma.anomaly.create({
        data: {
            userId: meta.user_id,
            transactionId: tx.id,
            severity: verdict?.final_severity || 'MEDIUM',
            score: analysis?.ml_score || 0,
            ruleViolations: analysis?.rule_flags || [],
            explanation: verdict?.explanation || 'Anomaly detected',
            detectedAt: new Date(meta.timestamp),
            rawAnalysis: analysis || {},
            modelVersion: 'v1'
        }
    });

    console.log(`🚨 [Analytics] Persisted Anomaly for Tx: ${txId}`);

    // Broadcast to SSE
    sseManager.sendToUser(meta.user_id, 'anomaly', {
        id: newAnomaly.id,
        displayId: tx.txId,
        score: analysis?.ml_score || 0,
        severity: verdict?.final_severity || 'MEDIUM',
        explanation: verdict?.explanation || 'Anomaly detected',
        timestamp: new Date(meta.timestamp).toISOString(),
        merchant: tx.merchant,
        amount: Number(tx.amount)
    });

    console.log(`📡 [SSE] Broadcast anomaly for ${txId} to user ${meta.user_id}`);
}
