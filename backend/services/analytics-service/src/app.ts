import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { z } from 'zod';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import router from './api/routes';


// 1. Load Environment Variables
dotenv.config();

// 2. Validate Environment Variables
const envSchema = z.object({
    PORT: z.string().default('3003'),
    SERVICE_NAME: z.string().default('analytics-service'),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    REDIS_URL: z.string().min(1, "REDIS_URL is required"),
    KAFKA_BOOTSTRAP_SERVERS: z.string().min(1, "KAFKA_BOOTSTRAP_SERVERS is required"),
});

try {
    envSchema.parse(process.env);
} catch (error) {
    if (error instanceof z.ZodError) {
        console.error('Invalid Environment Variables:', error.errors.map(e => `${e.path}: ${e.message}`).join(', '));
        process.exit(1);
    }
}

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// Swagger
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: { title: 'Analytics Service API', version: '1.0.0' },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter JWT token from auth-service /auth/login'
                }
            }
        },
        security: [{ bearerAuth: [] }]
    },
    apis: ['./src/**/*.ts', './src/**/*.js', './dist/**/*.js'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs-json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: process.env.SERVICE_NAME });
});

import { requireAuth } from './middleware/auth.middleware';

// API Routes
app.use(requireAuth);
app.use('/', router);

import { startKafkaConsumer } from './kafka/consumer';

// Start Server (Conditional)
if (require.main === module) {
    (async () => {
        try {
            // Start Kafka Consumer
            await startKafkaConsumer();

            app.listen(PORT, () => {
                console.log(`✅ ${process.env.SERVICE_NAME} running on port ${PORT}`);
            });
        } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    })();
}

export default app;
