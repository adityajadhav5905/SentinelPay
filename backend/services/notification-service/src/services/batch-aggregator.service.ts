// src/services/batch-aggregator.service.ts
/**
 * Redis-based anomaly batch aggregator.
 * Collects anomalies per userId:batchId and flushes them as a single batch
 * after a configurable inactivity window.
 */
import { redis } from './deduplication.service';

export interface AnomalyEventData {
    userId: string;
    batchId: string;
    txId: string;
    endUserId?: string;
    amount: number;
    currency: string;
    merchant?: string;
    category?: string;
    severity: string;
    mlScore: number;
    explanation: string;
    ruleFlags: string[];
    timestamp: string;
}

// In-memory flush timers keyed by "userId:batchId"
const flushTimers: Map<string, NodeJS.Timeout> = new Map();

// Callback registry for when a batch is ready to flush
type FlushCallback = (userId: string, batchId: string, anomalies: AnomalyEventData[]) => Promise<void>;
let onFlushCallback: FlushCallback | null = null;

const BATCH_KEY_PREFIX = 'anomaly_batch:';
const BATCH_TTL_SECONDS = 600; // 10 min max TTL for batch data in Redis
const FLUSH_DELAY_MS = parseInt(process.env.BATCH_FLUSH_DELAY_MS || '30000', 10); // 30s inactivity window

/**
 * Register a callback to be called when a batch is flushed.
 */
export const onBatchFlush = (callback: FlushCallback): void => {
    onFlushCallback = callback;
};

/**
 * Generate the Redis key for a batch.
 */
const getBatchKey = (userId: string, batchId: string): string =>
    `${BATCH_KEY_PREFIX}${userId}:${batchId}`;

/**
 * Add an anomaly to the batch. Resets the flush timer.
 */
export const addAnomalyToBatch = async (anomaly: AnomalyEventData): Promise<void> => {
    const { userId, batchId } = anomaly;
    const key = getBatchKey(userId, batchId);
    const timerKey = `${userId}:${batchId}`;

    if (redis && redis.status === 'ready') {
        // Push serialized anomaly to Redis list
        await redis.rpush(key, JSON.stringify(anomaly));
        await redis.expire(key, BATCH_TTL_SECONDS);
    } else {
        // Fallback: use in-memory (less resilient but functional)
        console.warn('⚠️ Redis not available for batching. Using in-memory fallback.');
        if (!inMemoryBatches.has(timerKey)) {
            inMemoryBatches.set(timerKey, []);
        }
        inMemoryBatches.get(timerKey)!.push(anomaly);
    }

    // Reset the flush timer — every new anomaly extends the window
    if (flushTimers.has(timerKey)) {
        clearTimeout(flushTimers.get(timerKey)!);
    }

    const timer = setTimeout(async () => {
        await flushBatch(userId, batchId);
    }, FLUSH_DELAY_MS);

    flushTimers.set(timerKey, timer);
    console.log(`📦 Anomaly buffered for batch ${batchId} (user: ${userId}). Flush in ${FLUSH_DELAY_MS / 1000}s.`);
};

// In-memory fallback storage
const inMemoryBatches: Map<string, AnomalyEventData[]> = new Map();

/**
 * Flush a batch: retrieve all anomalies and invoke the callback.
 */
export const flushBatch = async (userId: string, batchId: string): Promise<void> => {
    const key = getBatchKey(userId, batchId);
    const timerKey = `${userId}:${batchId}`;

    // Clear timer
    if (flushTimers.has(timerKey)) {
        clearTimeout(flushTimers.get(timerKey)!);
        flushTimers.delete(timerKey);
    }

    let anomalies: AnomalyEventData[] = [];

    if (redis && redis.status === 'ready') {
        const rawItems = await redis.lrange(key, 0, -1);
        anomalies = rawItems.map(item => JSON.parse(item));
        await redis.del(key);
    } else {
        // In-memory fallback
        anomalies = inMemoryBatches.get(timerKey) || [];
        inMemoryBatches.delete(timerKey);
    }

    if (anomalies.length === 0) {
        console.log(`ℹ️ Batch ${batchId} for user ${userId} is empty. Nothing to flush.`);
        return;
    }

    console.log(`🚀 Flushing batch ${batchId} for user ${userId}: ${anomalies.length} anomalies`);

    if (onFlushCallback) {
        try {
            await onFlushCallback(userId, batchId, anomalies);
        } catch (err) {
            console.error(`❌ Batch flush callback failed for ${userId}:${batchId}:`, err);
        }
    }
};
