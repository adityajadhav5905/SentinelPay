import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import router from './api/routes';
import { prisma } from '@sentinelpay/database';

// 1. Load Environment Variables
dotenv.config();

// 2. Constants
const PORT = process.env.PORT || 3004;
const SERVICE_NAME = process.env.SERVICE_NAME || 'subscription-service';

// 3. App Setup
const app = express();

app.use(cors());
app.use(express.json());

// 4. Swagger
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: { title: 'Subscription Service API', version: '1.0.0' },
        servers: [{ url: '/', description: 'API v1' }],
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
    apis: ['./src/**/*.ts'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs-json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// 5. Routes
app.use('/', router);

// Health Check
app.get('/health', async (req: Request, res: Response) => {
    try {
        // Optional: Check DB connection
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', service: SERVICE_NAME, db: 'connected' });
    } catch (error) {
        res.status(503).json({ status: 'error', service: SERVICE_NAME, db: 'disconnected' });
    }
});

import { startKafkaConsumer } from './kafka/consumer';

// 6. Start Server
if (process.env.NODE_ENV !== 'test') {
    // Start Kafka Consumer
    startKafkaConsumer()
        .then(() => {
            console.log(`✅ ${SERVICE_NAME} Kafka Consumer started`);
        })
        .catch(err => {
            console.error(`❌ Failed to start Kafka Consumer: `, err);
        });

    app.listen(PORT, () => {
        console.log(`✅ ${SERVICE_NAME} running on port ${PORT} `);
    });
}

export default app;
