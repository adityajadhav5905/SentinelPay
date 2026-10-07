/**
 * Pre-Start Validation Script
 * 
 * Validates environment and connectivity before starting the service.
 * Run with: npx ts-node src/validate.ts
 */
import { z } from 'zod';
import Redis from 'ioredis';
import { Kafka } from 'kafkajs';
import { PrismaClient, prisma } from '@sentinelpay/database';

// Environment schema
const envSchema = z.object({
    PORT: z.string().default('3003'),
    SERVICE_NAME: z.string().default('analytics-service'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    KAFKA_BOOTSTRAP_SERVERS: z.string().min(1, 'KAFKA_BOOTSTRAP_SERVERS is required'),
});

async function validateEnvironment(): Promise<void> {
    console.log('🔍 Validating environment variables...');
    try {
        envSchema.parse(process.env);
        console.log('✅ Environment variables valid');
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('❌ Invalid environment:', error.errors.map(e => `${e.path}: ${e.message}`).join(', '));
            process.exit(1);
        }
    }
}



async function validatePostgres(): Promise<void> {
    console.log('🔍 Checking PostgreSQL connection...');
    // const prisma = new PrismaClient(); // Removed local instantiation
    try {
        await prisma.$connect();
        await prisma.$queryRaw`SELECT 1`;
        console.log('✅ PostgreSQL connected');
    } catch (error) {
        console.error('❌ PostgreSQL connection failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

async function validateRedis(): Promise<void> {
    console.log('🔍 Checking Redis connection...');
    // ioredis connects automatically, but we can wait for ready or just ping
    const client = new Redis(process.env.REDIS_URL || '', { lazyConnect: true });
    try {
        await client.connect();
        await client.ping();
        console.log('✅ Redis connected');
    } catch (error) {
        console.error('❌ Redis connection failed:', error);
        process.exit(1);
    } finally {
        await client.quit();
    }
}

async function validateKafka(): Promise<void> {
    console.log('🔍 Checking Kafka connection...');
    const kafka = new Kafka({
        clientId: 'analytics-service-validator',
        brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092').split(','),
    });
    const admin = kafka.admin();
    try {
        await admin.connect();
        await admin.listTopics();
        console.log('✅ Kafka connected');
    } catch (error) {
        console.error('❌ Kafka connection failed:', error);
        process.exit(1);
    } finally {
        await admin.disconnect();
    }
}

async function main(): Promise<void> {
    console.log('\n🚀 Analytics Service Pre-Start Validation\n');
    console.log('─'.repeat(40));

    await validateEnvironment();
    await validatePostgres();
    await validateRedis();
    await validateKafka();

    console.log('─'.repeat(40));
    console.log('\n✅ All validations passed! Service ready to start.\n');
    process.exit(0);
}

// Load env vars
import dotenv from 'dotenv';
dotenv.config();

main().catch((error) => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
});
