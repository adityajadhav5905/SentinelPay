import { Kafka, Producer, Partitioners } from 'kafkajs';
import crypto from 'crypto';
import { config } from '../config';
import { Transaction } from '../api/validators';

// Kafka Event Schema per DOCUMENTATION.md
export interface TransactionEvent {
    meta: {
        trace_id: string;
        timestamp: string;
        source: 'REALTIME_API' | 'BATCH_CSV';
        user_id: string;
        end_user_id?: string;
        batch_id?: string;
    };
    data: {
        tx_id: string;
        amount: number;
        currency: string;
        location?: string;
        merchant?: string;
        category?: string;
    };
}

export class KafkaProducer {
    private producer: Producer;
    private isConnected: boolean = false;

    constructor() {
        const kafka = new Kafka({
            clientId: config.kafka.clientId,
            brokers: config.kafka.brokers,
        });

        this.producer = kafka.producer({
            createPartitioner: Partitioners.DefaultPartitioner
        });
    }

    async connect(): Promise<void> {
        if (!this.isConnected) {
            try {
                await this.producer.connect();
                this.isConnected = true;
                console.log('✅ Kafka Producer connected');
            } catch (error) {
                console.error('❌ Failed to connect to Kafka:', error);
                throw error;
            }
        }
    }

    async disconnect(): Promise<void> {
        if (this.isConnected) {
            await this.producer.disconnect();
            this.isConnected = false;
            console.log('🔌 Kafka Producer disconnected');
        }
    }

    /**
     * Publishes a transaction to Kafka with proper event schema
     */
    async publishTransaction(
        transaction: Transaction,
        source: 'REALTIME_API' | 'BATCH_CSV',
        batchId?: string
    ): Promise<string> {
        if (!this.isConnected) {
            throw new Error('Kafka Producer is not connected');
        }

        const traceId = crypto.randomUUID();

        const event: TransactionEvent = {
            meta: {
                trace_id: traceId,
                timestamp: transaction.timestamp, // Use event time, not ingestion time
                source: source,
                user_id: transaction.userId || 'default-user',
                end_user_id: transaction.endUserId,
                batch_id: batchId,
            },
            data: {
                tx_id: transaction.txId,
                amount: transaction.amount,
                currency: transaction.currency,
                location: transaction.location,
                merchant: transaction.merchant,
                category: transaction.category,
            },
        };

        try {
            await this.producer.send({
                topic: config.kafka.topics.transactions,
                messages: [
                    {
                        key: transaction.userId,
                        value: JSON.stringify(event),
                        headers: {
                            'trace-id': traceId,
                            'source': source,
                        },
                    },
                ],
            });
            return traceId;
        } catch (error) {
            console.error(`❌ Error publishing transaction ${transaction.txId}:`, error);
            throw error;
        }
    }
}

export const kafkaProducer = new KafkaProducer();
