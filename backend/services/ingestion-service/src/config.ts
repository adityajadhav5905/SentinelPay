
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    PORT: z.string().default('3000'),
    SERVICE_NAME: z.string().default('ingestion-service'),
    KAFKA_BOOTSTRAP_SERVERS: z.string().min(1, "KAFKA_BOOTSTRAP_SERVERS must be set"),
    KAFKA_TOPIC_TRANSACTIONS: z.string().default('transactions'),
    DATABASE_URL: z.string().min(1, "DATABASE_URL must be set"),
    REDIS_URL: z.string().min(1, "REDIS_URL must be set"),
    UPLOAD_DIR: z.string().default('uploads/'),
});

const env = envSchema.parse(process.env);

export const config = {
    port: parseInt(env.PORT, 10),
    serviceName: env.SERVICE_NAME,
    kafka: {
        brokers: env.KAFKA_BOOTSTRAP_SERVERS.split(','),
        clientId: env.SERVICE_NAME,
        topics: {
            transactions: env.KAFKA_TOPIC_TRANSACTIONS,
        },
    },
    redis: {
        url: env.REDIS_URL,
    },
    database: {
        url: env.DATABASE_URL,
    },
    uploadDir: env.UPLOAD_DIR,
};
